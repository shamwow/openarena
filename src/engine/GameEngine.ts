import type {
  GameState, PlayerId, ObjectId, CardInstance, CardDefinition,
  AddCounterOptions, AddManaOptions, CardFilter, ManaPool, ManaCost, EffectContext,
  StackEntry, GameEvent, PlayerAction,
  GameEngine as IGameEngine, CardType as CardTypeEnum,
  AbilityDefinition, EffectDuration, ContinuousEffect, TrackedMana,
  Layer as LayerType, DelayedTrigger, PredefinedTokenType, SearchLibraryOptions, CastPermission, PendingTrigger,
} from './types';
import { Cost, type CostContext } from './costs';
import { StaticAbility } from './abilities';
import {
  GameEventType, ActionType, CardType, Step, Zone,
  StackEntryType, manaCostTotal, Layer, emptyManaCost,
} from './types';
import { v4 as uuid } from 'uuid';
import {
  cloneCardInstance,
  createCardInstance,
  createInitialGameState,
  drawInitialHands,
  findCard,
  getEffectiveAbilities,
  getEffectiveSubtypes,
  getEffectiveSupertypes,
  hasType,
  getLastKnownInformation,
  getNextTimestamp,
  type DeckConfig,
} from './GameState';
import { EventBus } from './EventBus';
import { ZoneManager } from './ZoneManager';
import { ManaManager } from './ManaManager';
import { TurnManager } from './TurnManager';
import { PriorityManager } from './PriorityManager';
import { StackManager } from './StackManager';
import { StateBasedActions } from './StateBasedActions';
import { CombatManager } from './CombatManager';
import { ContinuousEffectsEngine } from './ContinuousEffects';
import { InteractionEngine } from './InteractionEngine';
import {
  createHasteAbilities,
  getActivationRuleProfile,
  getCombatDamageRuleProfile,
  getSurvivalRuleProfile,
  getTimingPermissionProfile,
} from './AbilityPrimitives';
import type { ChoiceHelper } from './types';

export type GameEventCallback = (event: GameEvent) => void;
export type StateChangeCallback = (state: GameState) => void;
export type ChoiceRequest = {
  type: 'chooseOne' | 'chooseN' | 'chooseUpToN' | 'chooseYesNo' | 'choosePlayer' | 'orderObjects';
  prompt: string;
  options: unknown[];
  count?: number;
  allowDuplicates?: boolean;
  labelFn?: (item: unknown) => string;
  resolve: (result: unknown) => void;
};

export interface GameEngineInit {
  decks?: DeckConfig[];
  initialState?: GameState;
  drawOpeningHands?: boolean;
  runGameLoopOnInit?: boolean;
}

const PREDEFINED_TOKENS: Record<PredefinedTokenType, Partial<CardDefinition> & { name: string; types: CardTypeEnum[] }> = {
  Treasure: {
    name: 'Treasure',
    types: [CardType.ARTIFACT as CardTypeEnum],
    subtypes: ['Treasure'],
    abilities: [{
      kind: 'activated',
      cost: { tap: true, sacrifice: { self: true } },
      effect: async (ctx) => {
        const color = await ctx.choices.chooseOne(
          'Add one mana of any color',
          ['W', 'U', 'B', 'R', 'G'] as const,
          (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
        );
        ctx.game.addMana(ctx.controller, color, 1);
      },
      timing: 'instant',
      isManaAbility: true,
      description: '{T}, Sacrifice this artifact: Add one mana of any color.',
    }],
  },
  Clue: {
    name: 'Clue',
    types: [CardType.ARTIFACT as CardTypeEnum],
    subtypes: ['Clue'],
    abilities: [{
      kind: 'activated',
      cost: { mana: { generic: 2, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, tap: true, sacrifice: { self: true } },
      effect: (ctx) => {
        ctx.game.drawCards(ctx.controller, 1);
      },
      timing: 'instant',
      isManaAbility: false,
      description: '{2}, {T}, Sacrifice this artifact: Draw a card.',
    }],
  },
  Food: {
    name: 'Food',
    types: [CardType.ARTIFACT as CardTypeEnum],
    subtypes: ['Food'],
    abilities: [{
      kind: 'activated',
      cost: { mana: { generic: 2, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, tap: true, sacrifice: { self: true } },
      effect: (ctx) => {
        ctx.game.gainLife(ctx.controller, 3);
      },
      timing: 'instant',
      isManaAbility: false,
      description: '{2}, {T}, Sacrifice this artifact: You gain 3 life.',
    }],
  },
  Blood: {
    name: 'Blood',
    types: [CardType.ARTIFACT as CardTypeEnum],
    subtypes: ['Blood'],
    abilities: [{
      kind: 'activated',
      cost: { mana: { generic: 1, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, tap: true, discard: 1, sacrifice: { self: true } },
      effect: (ctx) => {
        ctx.game.drawCards(ctx.controller, 1);
      },
      timing: 'instant',
      isManaAbility: false,
      description: '{1}, {T}, Discard a card, Sacrifice this artifact: Draw a card.',
    }],
  },
};

export class GameEngineImpl implements IGameEngine {
  private state: GameState;
  private eventBus: EventBus;
  private zoneManager: ZoneManager;
  private manaManager: ManaManager;
  private turnManager: TurnManager;
  private priorityManager: PriorityManager;
  private stackManager: StackManager;
  private sbaChecker: StateBasedActions;
  private combatManager: CombatManager;
  private continuousEffects: ContinuousEffectsEngine;
  private interactionEngine: InteractionEngine;

  private stateChangeListeners: StateChangeCallback[] = [];
  private choiceRequestHandler: ((req: ChoiceRequest) => void) | null = null;
  private pendingChoice: ChoiceRequest | null = null;
  private gameLogListeners: GameEventCallback[] = [];
  private processedEliminations = new Set<PlayerId>();

  constructor({
    decks,
    initialState,
    drawOpeningHands = initialState == null,
    runGameLoopOnInit = true,
  }: GameEngineInit = {}) {
    this.eventBus = new EventBus();
    this.zoneManager = new ZoneManager(
      this.eventBus,
      (_state, card, toZone) => this.chooseCommanderZoneReplacement(card, toZone),
    );
    this.manaManager = new ManaManager(this.eventBus);
    this.turnManager = new TurnManager(this.eventBus, this.zoneManager, this.manaManager);
    this.priorityManager = new PriorityManager();
    this.interactionEngine = new InteractionEngine();
    this.stackManager = new StackManager(this.eventBus, this.zoneManager, this.manaManager, this.interactionEngine);
    this.sbaChecker = new StateBasedActions(this.zoneManager, this.eventBus, this.interactionEngine);
    this.combatManager = new CombatManager(this.eventBus, this.zoneManager, this.manaManager, this.interactionEngine);
    this.continuousEffects = new ContinuousEffectsEngine();

    const resolvedDecks = decks ?? [];
    this.state = initialState ?? createInitialGameState(resolvedDecks);

    if (initialState == null) {
      this.state.currentStep = Step.UPKEEP;
      this.state.priorityPlayer = this.state.activePlayer;
    }

    if (drawOpeningHands) {
      drawInitialHands(this.state);
      if (initialState == null) {
        this.state.mulliganState = {
          activePlayer: this.state.activePlayer,
          taken: {},
          kept: {},
        };
        this.state.priorityPlayer = this.state.activePlayer;
      }
    }

    // Listen to all events for the game log
    this.eventBus.onAny((event) => {
      for (const listener of this.gameLogListeners) {
        listener(event);
      }
    });

    if (runGameLoopOnInit) {
      void this.runGameLoop().finally(() => this.notifyStateChange());
    }
    this.continuousEffects.applyAll(this.state);
    this.notifyStateChange();
  }

  // --- Public API ---

  getState(): GameState {
    return this.state;
  }

  onStateChange(listener: StateChangeCallback): () => void {
    this.stateChangeListeners.push(listener);
    return () => {
      const idx = this.stateChangeListeners.indexOf(listener);
      if (idx >= 0) this.stateChangeListeners.splice(idx, 1);
    };
  }

  onGameLog(listener: GameEventCallback): () => void {
    this.gameLogListeners.push(listener);
    return () => {
      const idx = this.gameLogListeners.indexOf(listener);
      if (idx >= 0) this.gameLogListeners.splice(idx, 1);
    };
  }

  onChoiceRequest(handler: (req: ChoiceRequest) => void): () => void {
    this.choiceRequestHandler = handler;
    // If there's a pending choice, send it immediately
    if (this.pendingChoice) {
      handler(this.pendingChoice);
    }

    return () => {
      if (this.choiceRequestHandler === handler) {
        this.choiceRequestHandler = null;
      }
    };
  }

  /** Submit a player action */
  async submitAction(action: PlayerAction): Promise<void> {
    if (this.state.isGameOver) return;

    switch (action.type) {
      case ActionType.PASS_PRIORITY:
        await this.handlePassPriority(action.playerId);
        break;

      case ActionType.PLAY_LAND:
        this.handlePlayLand(action.playerId, action.cardId, action.chosenFace);
        break;

      case ActionType.CAST_SPELL:
        await this.handleCastSpell(
          action.playerId,
          action.cardId,
          action.targets,
          action.modeChoices,
          action.xValue,
          action.chosenFace,
          action.chosenHalf,
          action.castMethod,
          action.castAsAdventure,
        );
        break;

      case ActionType.ACTIVATE_ABILITY:
        await this.handleActivateAbility(action.playerId, action.sourceId, action.abilityIndex, action.targets);
        break;

      case ActionType.DECLARE_ATTACKERS:
        this.handleDeclareAttackers(action.playerId, action.attackers);
        break;

      case ActionType.DECLARE_BLOCKERS:
        this.combatManager.declareBlockers(this.state, action.blockers);
        this.priorityManager.playerTookAction(this.state, action.playerId);
        break;

      case ActionType.CONCEDE:
        this.state.players[action.playerId].hasConceded = true;
        this.markPlayerLost(action.playerId, 'conceded');
        break;

      case ActionType.MULLIGAN_KEEP:
        await this.handleMulliganKeep(action.playerId);
        break;

      case ActionType.MULLIGAN_TAKE:
        this.handleMulliganTake(action.playerId);
        break;

      case ActionType.COMMANDER_TO_COMMAND_ZONE:
        this.handleCommanderToCommandZone(action.playerId, action.cardId);
        break;
    }

    await this.runGameLoop();
    this.notifyStateChange();
  }

  /** Check if a player has meaningful actions (anything beyond pass/concede/standalone mana abilities) */
  hasMeaningfulActions(playerId: PlayerId): boolean {
    const actions = this.getLegalActions(playerId);
    return actions.some(a => {
      if (a.type === ActionType.PASS_PRIORITY || a.type === ActionType.CONCEDE) return false;

      // Mana abilities on their own aren't meaningful — only if the player also has
      // spells/abilities to spend that mana on. But since getLegalActions already
      // checks mana affordability for spells, if a spell shows up the player has
      // a real action. So we only filter out *pure* mana ability activations.
      if (a.type === ActionType.ACTIVATE_ABILITY) {
        const card = findCard(this.state, a.sourceId);
        if (card) {
          const ability = getEffectiveAbilities(card)[a.abilityIndex];
          if (ability?.kind === 'activated' && ability.isManaAbility) return false;
        }
      }

      return true;
    });
  }

  /** Get legal actions for a player */
  getLegalActions(playerId: PlayerId): PlayerAction[] {
    const actions: PlayerAction[] = [];
    const player = this.state.players[playerId];
    if (player.hasLost || this.state.isGameOver) return actions;
    if (this.state.mulliganState) {
      if (this.state.mulliganState.activePlayer !== playerId) return actions;
      actions.push({ type: ActionType.MULLIGAN_KEEP, playerId });
      actions.push({ type: ActionType.MULLIGAN_TAKE, playerId });
      return actions;
    }
    if (this.state.priorityPlayer !== playerId) return actions;

    // Can always pass priority
    actions.push({ type: ActionType.PASS_PRIORITY, playerId });

    // Can always concede
    actions.push({ type: ActionType.CONCEDE, playerId });

    const hand = this.state.zones[playerId].HAND;
    const isSorcerySpeed = this.turnManager.canPlaySorcerySpeed(this.state, playerId);

    // Play land
    if (isSorcerySpeed && player.landsPlayedThisTurn < player.landPlaysAvailable) {
      for (const card of hand) {
        if (card.definition.types.includes(CardType.LAND)) {
          actions.push({ type: ActionType.PLAY_LAND, playerId, cardId: card.objectId });
        }
      }
    }

    // Cast spells from hand
    // Use canAffordWithManaProduction which considers untapped lands/artifacts/dorks
    for (const card of hand) {
      if (card.definition.types.includes(CardType.LAND)) continue;

      if (this.canCastWithCurrentTiming(playerId, card, card.zone)) {
        const castCost = this.getCastCostForLegalAction(
          playerId,
          card,
          this.mergePlainCosts(card.definition.cost),
        );
        if (castCost && this.canAffordCostWithTapSubstitution(playerId, card, castCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }

      if (card.definition.adventure) {
        const adventure = card.definition.adventure;
        const adventureDefinition = this.getEffectiveSpellDefinition(card, { castAsAdventure: true });
        const adventureCastCost = adventureDefinition
          ? this.getCastCostForLegalAction(playerId, card, this.mergePlainCosts(adventure.cost), adventureDefinition)
          : null;
        if (adventureDefinition && this.canCastWithCurrentTiming(playerId, adventureDefinition, card.zone) && adventureCastCost &&
          this.canAffordCostWithTapSubstitution(playerId, card, adventureCastCost)) {
          actions.push({
            type: ActionType.CAST_SPELL,
            playerId,
            cardId: card.objectId,
            castAsAdventure: true,
          });
        }
      }

      // MDFC back face: offer casting the back face as a separate action
      if (card.definition.isMDFC && card.definition.backFace) {
        const back = card.definition.backFace;
        if (back.types.includes(CardType.LAND)) {
          // Back face is a land — offer as a land play
          if (isSorcerySpeed && player.landsPlayedThisTurn < player.landPlaysAvailable) {
            actions.push({ type: ActionType.PLAY_LAND, playerId, cardId: card.objectId, chosenFace: 'back' });
          }
        } else {
          // Back face is a spell
          if (this.canCastWithCurrentTiming(playerId, back, card.zone)) {
            const backFaceCost = this.getCastCostForLegalAction(
              playerId,
              card,
              this.mergePlainCosts(back.cost),
              back,
            );
            if (backFaceCost && this.canAffordCostWithTapSubstitution(playerId, card, backFaceCost)) {
              actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, chosenFace: 'back' });
            }
          }
        }
      }

      for (const altCost of card.definition.alternativeCosts ?? []) {
        if (altCost.zone && altCost.zone !== card.zone) continue;
        const alternateCastCost = this.getCastCostForLegalAction(
          playerId,
          card,
          this.mergePlainCosts(card.definition.cost, altCost.cost),
        );
        if (alternateCastCost && this.canAffordCostWithTapSubstitution(playerId, card, alternateCastCost)) {
          actions.push({
            type: ActionType.CAST_SPELL,
            playerId,
            cardId: card.objectId,
            castMethod: altCost.id,
          });
        }
      }
    }

    // Split cards: offer left half, right half, and fused (if applicable)
    for (const card of hand) {
      if (!card.definition.splitHalf) continue;
      const right = card.definition.splitHalf;

      // Right half
      if (this.canCastWithCurrentTiming(playerId, right, card.zone)) {
        const rightHalfCost = this.getCastCostForLegalAction(
          playerId,
          card,
          this.mergePlainCosts(right.cost),
          right,
        );
        if (rightHalfCost && this.canAffordCostWithTapSubstitution(playerId, card, rightHalfCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, chosenHalf: 'right' });
        }
      }

      // Fuse: cast both halves as one spell (sorcery speed only)
      if (card.definition.hasFuse && isSorcerySpeed) {
        const fusedCost = Cost.from(card.definition.cost).combineWith(Cost.from(right.cost));
        const fusedCastCost = this.getCastCostForLegalAction(
          playerId,
          card,
          fusedCost,
        );
        if (fusedCastCost && this.canAffordCostWithTapSubstitution(playerId, card, fusedCastCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, chosenHalf: 'fused' });
        }
      }
    }

    // Cast spells from graveyard via alternative costs (e.g. flashback, escape)
    const graveyard = this.state.zones[playerId].GRAVEYARD;
    for (const card of graveyard) {
      if (!card.definition.alternativeCosts) continue;
      for (const altCost of card.definition.alternativeCosts) {
        if (altCost.zone !== 'GRAVEYARD') continue;

        if (!this.canCastWithCurrentTiming(playerId, card, card.zone)) continue;

        const graveyardCastCost = this.getCastCostForLegalAction(
          playerId,
          card,
          this.mergePlainCosts(card.definition.cost, altCost.cost),
        );
        if (graveyardCastCost && this.canAffordCostWithTapSubstitution(playerId, card, graveyardCastCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, castMethod: altCost.id });
        }
      }
    }

    // Cast commander from command zone
    const commandZone = this.state.zones[playerId].COMMAND;
    for (const card of commandZone) {
      if (player.commanderIds.includes(card.cardId)) {
        const tax = (player.commanderTimesCast[card.cardId] ?? 0) * 2;
        const commanderBaseCost = Cost.from(card.definition.cost);
        commanderBaseCost.addManaTax({ generic: tax });
        const commanderCastCost = this.getCastCostForLegalAction(
          playerId,
          card,
          commanderBaseCost,
        );
        if (this.canCastWithCurrentTiming(playerId, card, card.zone) && commanderCastCost && this.canAffordCostWithTapSubstitution(playerId, card, commanderCastCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }
    }

    // Cast creature portion of adventure cards from exile
    const exile = this.state.zones[playerId].EXILE;
    for (const card of exile) {
      if (card.castAsAdventure && card.definition.adventure) {
        // Can cast the creature portion from exile
        const exileAdventureCost = this.getCastCostForLegalAction(
          playerId,
          card,
          this.mergePlainCosts(card.definition.cost),
        );
        if (this.canCastWithCurrentTiming(playerId, card, card.zone) && exileAdventureCost && this.canAffordCostWithTapSubstitution(playerId, card, exileAdventureCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }

      const permission = this.findCastPermission(card, playerId);
      if (!permission || card.definition.types.includes(CardType.LAND)) {
        continue;
      }

      if (!this.canCastWithCurrentTiming(playerId, card, card.zone)) {
        continue;
      }

      const permissionCastCost = this.getCastCostForLegalAction(
        playerId,
        card,
        this.mergePlainCosts(card.definition.cost, permission.alternativeCost),
      );
      if (permissionCastCost && this.canAffordCostWithTapSubstitution(playerId, card, permissionCastCost)) {
        actions.push({
          type: ActionType.CAST_SPELL,
          playerId,
          cardId: card.objectId,
          castMethod: this.getCastPermissionMethod(permission),
        });
      }
    }

    const activatableZones: Array<{ zone: Zone; cards: CardInstance[] }> = [
      { zone: Zone.BATTLEFIELD, cards: this.state.zones[playerId].BATTLEFIELD },
      { zone: Zone.HAND, cards: this.state.zones[playerId].HAND },
      { zone: Zone.GRAVEYARD, cards: this.state.zones[playerId].GRAVEYARD },
    ];
    for (const { zone, cards } of activatableZones) {
      for (const card of cards) {
        const isPlaneswalker = zone === Zone.BATTLEFIELD && hasType(card, CardType.PLANESWALKER as CardTypeEnum);
        const loyaltyUsed = isPlaneswalker &&
          (this.state.loyaltyAbilitiesUsedThisTurn ?? []).includes(card.objectId);

        const abilities = getEffectiveAbilities(card);
        for (let i = 0; i < abilities.length; i++) {
          const ability = abilities[i];
          if (ability.kind !== 'activated') continue;
          if ((ability.activationZone ?? Zone.BATTLEFIELD) !== zone) continue;
          if (!this.canActivateActivatedAbility(card, ability, playerId, i)) continue;
          const abilCost = Cost.from(ability.cost);
          if (!this.canAffordCostWithTapSubstitution(
            playerId,
            card,
            abilCost,
            abilCost.requiresTap() ? new Set([card.objectId]) : new Set(),
          )) continue;
          if (isPlaneswalker && loyaltyUsed) continue;

          actions.push({
            type: ActionType.ACTIVATE_ABILITY,
            playerId,
            sourceId: card.objectId,
            abilityIndex: i,
          });
        }
      }
    }

    // Declare attackers (during declare attackers step)
    if (this.state.currentStep === Step.DECLARE_ATTACKERS && playerId === this.state.activePlayer) {
      const attackers = this.combatManager.getValidAttackers(this.state);
      if (attackers.length > 0) {
        // Return a generic "declare attackers" action — UI will handle specifics
        actions.push({
          type: ActionType.DECLARE_ATTACKERS,
          playerId,
          attackers: [],
        });
      }
    }

    return actions;
  }

  // --- IGameEngine implementation ---

  drawCards(player: PlayerId, count: number): void {
    this.zoneManager.drawCards(this.state, player, count);
  }

  addMana(player: PlayerId, color: keyof ManaPool, amount: number, options?: AddManaOptions): void {
    this.manaManager.addMana(this.state, player, color, amount, options);
  }

  private emitTappedForManaEvent(player: PlayerId, source: CardInstance): void {
    const event: GameEvent = {
      type: GameEventType.TAPPED_FOR_MANA,
      timestamp: getNextTimestamp(this.state),
      objectId: source.objectId,
      cardId: source.cardId,
      objectZoneChangeCounter: source.zoneChangeCounter,
      lastKnownInfo: cloneCardInstance(source),
      player,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
    this.resolveImmediateTriggeredManaAbilities(event);
  }

  private resolveImmediateTriggeredManaAbilities(event: GameEvent): void {
    const triggers = this.eventBus.checkTriggers(event, this.state);
    for (const trigger of triggers) {
      if (trigger.ability.isManaAbility) {
        this.resolveTriggeredManaAbility(trigger);
      } else {
        this.state.pendingTriggers.push(trigger);
      }
    }
  }

  private resolveTriggeredManaAbility(trigger: PendingTrigger): void {
    const disallowChoice = async () => {
      throw new Error('Triggered mana abilities cannot request choices or targets.');
    };
    const ctx: EffectContext = {
      game: this,
      state: this.state,
      source: trigger.source,
      controller: trigger.controller,
      targets: [],
      event: trigger.event,
      choices: this.createChoiceHelper(trigger.controller),
      chooseTarget: disallowChoice,
      chooseTargets: disallowChoice,
    };
    const result = trigger.ability.effect(ctx);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      throw new Error('Triggered mana abilities must resolve synchronously.');
    }
  }

  payMana(player: PlayerId, cost: ManaCost): boolean {
    return this.manaManager.payMana(this.state, player, cost);
  }

  canPayMana(player: PlayerId, cost: ManaCost): boolean {
    return this.manaManager.canPayMana(this.state, player, cost);
  }

  gainLife(player: PlayerId, amount: number): void {
    this.state.players[player].life += amount;
    const event: GameEvent = {
      type: GameEventType.LIFE_GAINED,
      timestamp: getNextTimestamp(this.state),
      player,
      amount,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
    const triggers = this.eventBus.checkTriggers(event, this.state);
    for (const t of triggers) this.state.pendingTriggers.push(t);
  }

  loseLife(player: PlayerId, amount: number): void {
    this.state.players[player].life -= amount;
    const event: GameEvent = {
      type: GameEventType.LIFE_LOST,
      timestamp: getNextTimestamp(this.state),
      player,
      amount,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  dealDamage(sourceId: ObjectId, targetId: ObjectId | PlayerId, amount: number, isCombat: boolean): void {
    if (amount <= 0) return;

    const source = findCard(this.state, sourceId);
    const combatDamageProfile = source ? getCombatDamageRuleProfile(source, this.state) : null;

    if (source) {
      const isPlayerTarget = typeof targetId === 'string' && targetId.startsWith('player');
      if (!isPlayerTarget) {
        const target = findCard(this.state, targetId as string);
        if (target && this.interactionEngine.preventsDamage(this.state, source, target, isCombat)) return;
      }
    }

    // 3D: Apply replacement effects for damage prevention
    const damageEvent: GameEvent = {
      type: GameEventType.DAMAGE_DEALT,
      timestamp: getNextTimestamp(this.state),
      sourceId,
      targetId,
      amount,
      isCombatDamage: isCombat,
      isCommanderDamage: false,
    };
    const replaced = this.eventBus.applyReplacements(damageEvent, this.state.replacementEffects, this.state);
    if (replaced === null) return; // damage fully prevented

    // Use the (possibly modified) amount from replacement effects
    const finalAmount = (replaced as import('./types').DamageDealtEvent).amount;
    if (finalAmount <= 0) return;

    if (typeof targetId === 'string' && targetId.startsWith('player')) {
      const player = this.state.players[targetId as PlayerId];
      if (!player || player.hasLost) return;
      player.life -= finalAmount;

      const isCommanderDamage = isCombat && source
        ? this.state.players[source.owner]?.commanderIds.includes(source.cardId)
        : false;
      if (isCommanderDamage && source) {
        player.commanderDamageReceived[source.cardId] =
          (player.commanderDamageReceived[source.cardId] ?? 0) + finalAmount;
      }

      if (source && combatDamageProfile?.controllerGainsLifeFromDamage) {
        this.gainLife(source.controller, finalAmount);
      }
    } else {
      const target = findCard(this.state, targetId as string);
      if (!target || target.zone !== 'BATTLEFIELD') return;
      if (hasType(target, CardType.PLANESWALKER as CardTypeEnum)) {
        target.counters['loyalty'] = (target.counters['loyalty'] ?? target.definition.loyalty ?? 0) - finalAmount;
      } else {
        target.markedDamage += finalAmount;
        if (combatDamageProfile?.marksDeathtouchDamage) {
          target.counters['deathtouch-damage'] = 1;
        }
      }

      if (source && combatDamageProfile?.controllerGainsLifeFromDamage) {
        this.gainLife(source.controller, finalAmount);
      }
    }

    const event: GameEvent = {
      type: GameEventType.DAMAGE_DEALT,
      timestamp: getNextTimestamp(this.state),
      sourceId,
      targetId,
      amount: finalAmount,
      isCombatDamage: isCombat,
      isCommanderDamage: Boolean(
        isCombat && source && this.state.players[source.owner]?.commanderIds.includes(source.cardId)
      ),
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
    const triggers = this.eventBus.checkTriggers(event, this.state);
    for (const t of triggers) this.state.pendingTriggers.push(t);
  }

  destroyPermanent(objectId: ObjectId): void {
    const card = findCard(this.state, objectId);
    if (!card || card.zone !== 'BATTLEFIELD') return;
    if (getSurvivalRuleProfile(card, this.state).ignoreDestroy) return;
    if ((card.counters['regeneration-shield'] ?? 0) > 0 && (card.counters['cant-regenerate'] ?? 0) === 0) {
      card.counters['regeneration-shield'] -= 1;
      if (card.counters['regeneration-shield'] <= 0) {
        delete card.counters['regeneration-shield'];
      }
      card.tapped = true;
      card.markedDamage = 0;
      delete card.counters['deathtouch-damage'];
      this.removePermanentFromCombat(card.objectId);
      return;
    }

    const event: GameEvent = {
      type: GameEventType.DESTROYED,
      timestamp: getNextTimestamp(this.state),
      objectId,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
    this.zoneManager.moveCard(this.state, objectId, 'GRAVEYARD', card.owner);
  }

  sacrificePermanent(objectId: ObjectId, controller: PlayerId): void {
    const card = findCard(this.state, objectId);
    if (!card || card.zone !== 'BATTLEFIELD') return;
    const event: GameEvent = {
      type: GameEventType.SACRIFICED,
      timestamp: getNextTimestamp(this.state),
      objectId,
      cardId: card.cardId,
      objectZoneChangeCounter: card.zoneChangeCounter,
      lastKnownInfo: card,
      controller,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
    this.zoneManager.moveCard(this.state, objectId, 'GRAVEYARD');
  }

  exilePermanent(objectId: ObjectId): void {
    this.zoneManager.moveCard(this.state, objectId, 'EXILE');
  }

  moveCard(objectId: ObjectId, toZone: Zone, toOwner?: PlayerId): void {
    this.continuousEffects.applyAll(this.state);
    this.zoneManager.moveCard(this.state, objectId, toZone, toOwner);
  }

  createToken(controller: PlayerId, definition: Partial<CardDefinition>): CardInstance {
    this.continuousEffects.applyAll(this.state);
    return this.zoneManager.createToken(
      this.state,
      controller,
      definition as Partial<CardDefinition> & { name: string; types: CardTypeEnum[] }
    );
  }

  createPredefinedToken(controller: PlayerId, tokenType: PredefinedTokenType): CardInstance {
    const token = this.createToken(controller, PREDEFINED_TOKENS[tokenType]);
    const tokenEvent = this.state.eventLog.findLast(
      (event) => event.type === GameEventType.TOKEN_CREATED && event.objectId === token.objectId,
    );
    if (tokenEvent && tokenEvent.type === GameEventType.TOKEN_CREATED) {
      tokenEvent.tokenType = tokenType;
    }
    return token;
  }

  addCounters(objectId: ObjectId, counterType: string, amount: number, options: AddCounterOptions = {}): void {
    const card = findCard(this.state, objectId);
    if (!card) return;
    card.counters[counterType] = (card.counters[counterType] ?? 0) + amount;

    const event: GameEvent = {
      type: GameEventType.COUNTER_ADDED,
      timestamp: getNextTimestamp(this.state),
      objectId,
      cardId: card.cardId,
      objectZoneChangeCounter: card.zoneChangeCounter,
      sourceId: options.sourceId,
      sourceCardId: options.sourceCardId,
      sourceZoneChangeCounter: options.sourceZoneChangeCounter,
      counterType,
      amount,
      player: options.player,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
    const triggers = this.eventBus.checkTriggers(event, this.state);
    for (const trigger of triggers) {
      this.state.pendingTriggers.push(trigger);
    }
  }

  removeCounters(objectId: ObjectId, counterType: string, amount: number): void {
    const card = findCard(this.state, objectId);
    if (!card) return;
    card.counters[counterType] = Math.max(0, (card.counters[counterType] ?? 0) - amount);
    if (card.counters[counterType] === 0) delete card.counters[counterType];
  }

  tapPermanent(objectId: ObjectId): void {
    this.zoneManager.tapPermanent(this.state, objectId);
  }

  untapPermanent(objectId: ObjectId): void {
    this.zoneManager.untapPermanent(this.state, objectId);
  }

  counterSpell(stackEntryId: ObjectId): void {
    this.stackManager.counterSpell(this.state, stackEntryId);
  }

  findCards(zone: Zone, filter?: CardFilter, controller?: PlayerId): CardInstance[] {
    const results: CardInstance[] = [];
    const players = controller ? [controller] : this.state.turnOrder;

    for (const pid of players) {
      for (const card of this.state.zones[pid][zone]) {
        if (zone === 'BATTLEFIELD' && card.phasedOut) continue;
        if (!filter || this.matchesFilter(card, filter, controller)) {
          results.push(card);
        }
      }
    }
    return results;
  }

  getCard(objectId: ObjectId): CardInstance | undefined {
    return findCard(this.state, objectId);
  }

  getBattlefield(filter?: CardFilter, controller?: PlayerId): CardInstance[] {
    return this.findCards('BATTLEFIELD', filter, controller);
  }

  getHand(player: PlayerId): CardInstance[] {
    return this.state.zones[player].HAND;
  }

  getGraveyard(player: PlayerId): CardInstance[] {
    return this.state.zones[player].GRAVEYARD;
  }

  getLibrary(player: PlayerId): CardInstance[] {
    return this.state.zones[player].LIBRARY;
  }

  discardCard(player: PlayerId, objectId: ObjectId): void {
    this.zoneManager.discardCard(this.state, player, objectId);
  }

  shuffleLibrary(player: PlayerId): void {
    this.zoneManager.shuffleLibrary(this.state, player);
  }

  emitEvent(event: GameEvent): void {
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  getOpponents(player: PlayerId): PlayerId[] {
    return this.state.turnOrder.filter(pid => pid !== player && !this.state.players[pid].hasLost);
  }

  getActivePlayers(): PlayerId[] {
    return this.state.turnOrder.filter(pid => !this.state.players[pid].hasLost);
  }

  // --- Phase 5: Copy, Control, Advanced Mechanics ---

  copyPermanent(objectId: ObjectId, controller: PlayerId): CardInstance | undefined {
    this.continuousEffects.applyAll(this.state);
    const original = findCard(this.state, objectId);
    if (!original || original.zone !== 'BATTLEFIELD') return undefined;

    // Create a token that copies the target permanent's definition
    const tokenDef: CardDefinition = {
      ...original.definition,
      id: `copy-${original.definition.id}-${Date.now()}`,
    };
    return this.zoneManager.createToken(this.state, controller, tokenDef, { copyOf: original.objectId });
  }

  copySpellOnStack(stackEntryId: ObjectId, newController: PlayerId): void {
    const original = this.state.stack.find(e => e.id === stackEntryId);
    if (!original) return;

    const copy: StackEntry = {
      id: uuid(),
      entryType: original.entryType,
      sourceId: original.sourceId,
      sourceCardId: original.sourceCardId,
      sourceZoneChangeCounter: original.sourceZoneChangeCounter,
      sourceSnapshot: original.sourceSnapshot,
      controller: newController,
      timestamp: getNextTimestamp(this.state),
      targets: [...original.targets],
      targetZoneChangeCounters: original.targetZoneChangeCounters ? [...original.targetZoneChangeCounters] : undefined,
      targetSpecs: original.targetSpecs ? [...original.targetSpecs] : undefined,
      targetGroupCounts: original.targetGroupCounts ? [...original.targetGroupCounts] : undefined,
      ability: original.ability,
      xValue: original.xValue,
      spellDefinition: original.spellDefinition,
      modeChoices: original.modeChoices ? [...original.modeChoices] : undefined,
      castMethod: original.castMethod,
      additionalCostsPaid: original.additionalCostsPaid ? [...original.additionalCostsPaid] : undefined,
      castAsAdventure: original.castAsAdventure,
      chosenFace: original.chosenFace,
      chosenHalf: original.chosenHalf,
      resolve: original.resolve,
    };

    // Push copy on top of stack
    this.state.stack.push(copy);
  }

  changeControl(objectId: ObjectId, newController: PlayerId, duration?: EffectDuration): void {
    const card = findCard(this.state, objectId);
    if (!card || card.zone !== 'BATTLEFIELD') return;

    const oldController = card.controller;
    if (oldController === newController) return;

    // Remove from old controller's battlefield
    const oldZone = this.state.zones[oldController].BATTLEFIELD;
    const idx = oldZone.indexOf(card);
    if (idx >= 0) {
      oldZone.splice(idx, 1);
    }

    // Update controller and add to new controller's battlefield
    card.controller = newController;
    this.state.zones[newController].BATTLEFIELD.push(card);

    // If duration is provided, add a continuous effect that reverts at cleanup
    if (duration) {
      const revertEffect: ContinuousEffect = {
        id: uuid(),
        sourceId: objectId,
        layer: Layer.CONTROL as LayerType,
        timestamp: getNextTimestamp(this.state),
        duration,
        appliesTo: (permanent) => permanent.objectId === objectId,
        apply: (permanent) => {
          permanent.controller = newController;
        },
      };
      this.state.continuousEffects.push(revertEffect);
    }
  }

  async castWithoutPayingManaCost(cardId: ObjectId, controller: PlayerId): Promise<void> {
    const card = findCard(this.state, cardId);
    if (!card) return;

    // Put the spell on the stack without paying mana costs
    const stackEntry = this.stackManager.castSpell(
      this.state,
      card,
      controller,
      [],
      0, // X = 0 when cast without paying mana cost
    );

    // Handle modal spells
    const spell = card.definition.spell;
    if (spell?.kind === 'modal') {
      const choices = this.createChoiceHelper(controller);
      const modeLabels = spell.modes.map((m, i) => ({ label: m.label, index: i }));
        const selected = await choices.chooseN(
          `Choose ${spell.chooseCount} mode(s)`,
          modeLabels,
          spell.chooseCount,
          (m) => m.label,
          { allowDuplicates: spell.allowRepeatedModes }
        );
        stackEntry.modeChoices = selected.map(m => m.index);
      stackEntry.targetSpecs = stackEntry.modeChoices.flatMap((modeIndex) => spell.modes[modeIndex]?.targets ?? []);
    }

    await this.applyCastBehaviors(controller, card, card.definition, stackEntry);
    this.priorityManager.playerTookAction(this.state, controller);
  }

  airbendObject(objectId: ObjectId, cost: import('./types').PlainCost, actingPlayer: PlayerId): void {
    void actingPlayer;
    const card = findCard(this.state, objectId);
    if (!card) return;

    if (card.zone === Zone.BATTLEFIELD) {
      this.zoneManager.moveCard(this.state, objectId, Zone.EXILE, card.owner);
    } else if (card.zone === Zone.STACK) {
      this.stackManager.moveSpellFromStack(this.state, objectId, Zone.EXILE, card.owner);
    } else {
      return;
    }

    const exiledCard = findCard(this.state, objectId);
    if (!exiledCard || exiledCard.zone !== Zone.EXILE || exiledCard.isToken) {
      return;
    }

    this.state.castPermissions = this.state.castPermissions.filter((permission) =>
      permission.objectId !== exiledCard.objectId
    );
    this.state.castPermissions.push({
      objectId: exiledCard.objectId,
      zoneChangeCounter: exiledCard.zoneChangeCounter,
      zone: Zone.EXILE,
      castBy: exiledCard.owner,
      owner: exiledCard.owner,
      alternativeCost: Cost.from(cost).toPlainCost(),
      reason: 'airbend',
      timing: 'normal',
      castOnly: true,
    });
  }

  earthbendLand(targetId: ObjectId, counterCount: number, returnController: PlayerId): void {
    const target = findCard(this.state, targetId);
    if (!target || target.zone !== Zone.BATTLEFIELD || target.phasedOut) return;
    if (!hasType(target, CardType.LAND)) return;
    if (target.controller !== returnController) return;

    const objectZoneChangeCounter = target.zoneChangeCounter;
    const objectId = target.objectId;
    const objectInstanceKey = `${objectId}:${objectZoneChangeCounter}`;
    const effectDuration: EffectDuration = {
      type: 'while-condition',
      check: (game) => Boolean(findCard(game, objectId, objectZoneChangeCounter)),
    };
    const appliesTo = (permanent: CardInstance) =>
      permanent.objectId === objectId &&
      permanent.zoneChangeCounter === objectZoneChangeCounter;

    this.continuousEffects.addEffect(this.state, {
      id: `earthbend-add-type:${objectInstanceKey}`,
      sourceId: objectId,
      layer: Layer.TYPE as LayerType,
      timestamp: getNextTimestamp(this.state),
      duration: effectDuration,
      appliesTo,
      apply: (permanent) => {
        const types = permanent.modifiedTypes ?? [...permanent.definition.types];
        if (!types.includes(CardType.CREATURE)) {
          types.push(CardType.CREATURE);
        }
        permanent.modifiedTypes = types;
      },
    });
    this.continuousEffects.addEffect(this.state, {
      id: `earthbend-set-pt:${objectInstanceKey}`,
      sourceId: objectId,
      layer: Layer.PT_SET as LayerType,
      timestamp: getNextTimestamp(this.state),
      duration: effectDuration,
      appliesTo,
      apply: (permanent) => {
        permanent.modifiedPower = 0;
        permanent.modifiedToughness = 0;
      },
    });
    this.continuousEffects.addEffect(this.state, {
      id: `earthbend-haste:${objectInstanceKey}`,
      sourceId: objectId,
      layer: Layer.ABILITY as LayerType,
      timestamp: getNextTimestamp(this.state),
      duration: effectDuration,
      appliesTo,
      apply: (permanent) => {
        const grantedAbilities = permanent.modifiedAbilities ?? [...permanent.definition.abilities];
        grantedAbilities.push(...createHasteAbilities());
        permanent.modifiedAbilities = grantedAbilities;
      },
    });

    this.continuousEffects.applyAll(this.state);
    if (counterCount > 0) {
      this.addCounters(objectId, '+1/+1', counterCount, { player: returnController });
      this.continuousEffects.applyAll(this.state);
    }

    const sourceSnapshot = cloneCardInstance(target);
    this.registerDelayedTrigger({
      id: `earthbend-return:${objectInstanceKey}`,
      source: sourceSnapshot,
      controller: returnController,
      expiresAfterTrigger: true,
      ability: {
        kind: 'triggered',
        trigger: {
          on: 'custom',
          match: (event) =>
            event.type === GameEventType.LEAVES_BATTLEFIELD &&
            event.objectId === objectId &&
            event.objectZoneChangeCounter === objectZoneChangeCounter &&
            (event.destination === Zone.GRAVEYARD || event.destination === Zone.EXILE),
        },
        optional: false,
        description: 'Return earthbended land',
        effect: (ctx) => {
          const currentCard = findCard(ctx.state, objectId);
          if (!currentCard) return;
          if (currentCard.zone !== Zone.GRAVEYARD && currentCard.zone !== Zone.EXILE) return;
          this.zoneManager.moveCard(ctx.state, currentCard.objectId, Zone.BATTLEFIELD, returnController, { tapped: true });
        },
      },
    });
  }

  grantPumpToObjectsUntilEndOfTurn(objectIds: ObjectId[], power: number, toughness: number): void {
    const objectInstanceKeys = new Set(
      objectIds.flatMap((objectId) => {
        const card = findCard(this.state, objectId);
        if (!card || card.zone !== Zone.BATTLEFIELD || card.phasedOut) {
          return [];
        }
        return [`${card.objectId}:${card.zoneChangeCounter}`];
      }),
    );
    if (objectInstanceKeys.size === 0) return;

    const timestamp = getNextTimestamp(this.state);
    this.continuousEffects.addEffect(this.state, {
      id: `grant-pump-eot:${timestamp}:${power}:${toughness}`,
      sourceId: uuid(),
      layer: Layer.PT_MODIFY as LayerType,
      timestamp,
      duration: { type: 'until-end-of-turn' },
      appliesTo: (permanent) =>
        objectInstanceKeys.has(`${permanent.objectId}:${permanent.zoneChangeCounter}`) &&
        !permanent.phasedOut,
      apply: (permanent) => {
        permanent.modifiedPower = (permanent.modifiedPower ?? permanent.definition.power ?? 0) + power;
        permanent.modifiedToughness = (permanent.modifiedToughness ?? permanent.definition.toughness ?? 0) + toughness;
      },
    });
  }

  grantAbilitiesUntilEndOfTurn(
    sourceId: ObjectId,
    objectId: ObjectId,
    zoneChangeCounter: number,
    abilities: AbilityDefinition[],
  ): void {
    const target = findCard(this.state, objectId);
    if (!target || target.zone !== Zone.BATTLEFIELD || target.phasedOut) return;
    if (target.zoneChangeCounter !== zoneChangeCounter) return;

    this.continuousEffects.addEffect(this.state, {
      id: `grant-abilities-eot:${sourceId}:${objectId}:${zoneChangeCounter}`,
      sourceId,
      layer: Layer.ABILITY as LayerType,
      timestamp: getNextTimestamp(this.state),
      duration: { type: 'until-end-of-turn' },
      appliesTo: (permanent) =>
        permanent.objectId === objectId &&
        permanent.zoneChangeCounter === zoneChangeCounter &&
        !permanent.phasedOut,
      apply: (permanent) => {
        const grantedAbilities = permanent.modifiedAbilities ?? [...permanent.definition.abilities];
        grantedAbilities.push(...abilities);
        permanent.modifiedAbilities = grantedAbilities;
      },
    });
  }

  createEmblem(controller: PlayerId, abilities: AbilityDefinition[], description: string): CardInstance {
    const emblemDef: CardDefinition = {
      id: `emblem-${description.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      name: description,
      colorIdentity: [],
      types: [],
      supertypes: [],
      subtypes: [],
      abilities,
    };

    const instance = createCardInstance(emblemDef, controller, 'COMMAND', getNextTimestamp(this.state));
    instance.controller = controller;
    this.state.zones[controller].COMMAND.push(instance);

    return instance;
  }

  // --- Search / Selection Actions ---

  async searchLibrary(player: PlayerId, filter: CardFilter, destination: Zone, count: number): Promise<CardInstance[]> {
    return this.searchLibraryWithOptions({
      player,
      filter,
      destination,
      count,
      optional: true,
      shuffle: true,
    });
  }

  async searchLibraryWithOptions(options: SearchLibraryOptions): Promise<CardInstance[]> {
    const chooser = options.chooser ?? options.player;
    const library = this.state.zones[options.player].LIBRARY;
    const matching = library.filter(card => this.matchesFilter(card, options.filter, chooser));
    const helper = this.createChoiceHelper(chooser);
    const promptOwner = chooser === options.player ? 'your' : `${this.state.players[options.player].name}'s`;
    const selected = options.optional === false
      ? await helper.chooseN(
        `Search ${promptOwner} library`,
        matching,
        Math.min(options.count, matching.length),
        (card) => card.definition.name,
      )
      : await helper.chooseUpToN(
        `Search ${promptOwner} library (pick up to ${options.count})`,
        matching,
        options.count,
        (card) => card.definition.name,
      );

    for (const card of selected) {
      this.zoneManager.moveCard(this.state, card.objectId, options.destination, card.owner);
    }

    if (options.shuffle ?? true) {
      this.zoneManager.shuffleLibrary(this.state, options.player);
    }

    const event: GameEvent = {
      type: GameEventType.SEARCHED_LIBRARY,
      timestamp: getNextTimestamp(this.state),
      player: options.player,
      foundIds: selected.map(c => c.objectId),
      destination: options.destination,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);

    return selected;
  }

  async scry(player: PlayerId, count: number): Promise<void> {
    const topCards = this.zoneManager.peekTop(this.state, player, count);
    if (topCards.length === 0) return;

    const choices = this.createChoiceHelper(player);

    // Choose which cards go to the bottom
    const toBottom = await choices.chooseUpToN(
      `Scry ${count}: choose cards to put on the bottom of your library`,
      topCards,
      topCards.length,
      (card) => card.definition.name,
    );

    // The rest stay on top
    const toTop = topCards.filter(c => !toBottom.includes(c));

    // Order cards going on top (if more than 1)
    let orderedTop = toTop;
    if (toTop.length > 1) {
      orderedTop = await choices.orderObjects(
        'Order cards for the top of your library (first = top)',
        toTop,
        (card) => card.definition.name,
      );
    }

    // Remove all peeked cards from the library
    const library = this.state.zones[player].LIBRARY;
    for (const card of topCards) {
      const idx = library.indexOf(card);
      if (idx >= 0) library.splice(idx, 1);
    }

    // Put bottom cards at the beginning of the library (bottom of deck)
    for (const card of toBottom) {
      library.unshift(card);
    }

    // Put top cards at the end of the library (top of deck), in order
    // orderedTop[0] should be the topmost card = last in array
    for (let i = orderedTop.length - 1; i >= 0; i--) {
      library.push(orderedTop[i]);
    }

    const event: GameEvent = {
      type: GameEventType.SCRY,
      timestamp: getNextTimestamp(this.state),
      player,
      count,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  mill(player: PlayerId, count: number): void {
    const topCards = this.zoneManager.peekTop(this.state, player, count);
    const milledIds: ObjectId[] = [];

    for (const card of topCards) {
      milledIds.push(card.objectId);
      this.zoneManager.moveCard(this.state, card.objectId, 'GRAVEYARD', player);
    }

    const event: GameEvent = {
      type: GameEventType.MILLED,
      timestamp: getNextTimestamp(this.state),
      player,
      objectIds: milledIds,
      count: milledIds.length,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  fight(creatureAId: ObjectId, creatureBId: ObjectId): void {
    const creatureA = findCard(this.state, creatureAId);
    const creatureB = findCard(this.state, creatureBId);
    if (!creatureA || !creatureB) return;

    const powerA = creatureA.modifiedPower ?? creatureA.definition.power ?? 0;
    const powerB = creatureB.modifiedPower ?? creatureB.definition.power ?? 0;

    this.dealDamage(creatureAId, creatureBId, powerA, false);
    this.dealDamage(creatureBId, creatureAId, powerB, false);
  }

  returnToHand(objectId: ObjectId): void {
    const card = findCard(this.state, objectId);
    if (!card) return;
    this.zoneManager.moveCard(this.state, objectId, 'HAND', card.owner);
  }

  attachPermanent(attachmentId: ObjectId, hostId: ObjectId): void {
    const attachment = findCard(this.state, attachmentId);
    const host = findCard(this.state, hostId);
    if (!attachment || !host) return;
    if (attachment.zone !== 'BATTLEFIELD' || host.zone !== 'BATTLEFIELD') return;
    if (attachment.phasedOut || host.phasedOut) return;
    if (attachment.definition.attachment?.type === 'Equipment' && !hasType(host, CardType.CREATURE as CardTypeEnum)) return;
    if (attachment.definition.attachment?.type === 'Aura') {
      if (!this.matchesTargetSpec(host, attachment.definition.attachment.target, attachment.controller)) return;
    }
    if (this.interactionEngine.preventsAttachment(this.state, attachment, host)) return;

    // Detach from previous host if already attached
    if (attachment.attachedTo) {
      this.detachPermanent(attachmentId);
    }

    attachment.attachedTo = hostId;
    if (!host.attachments.includes(attachmentId)) {
      host.attachments.push(attachmentId);
    }
  }

  detachPermanent(attachmentId: ObjectId): void {
    const attachment = findCard(this.state, attachmentId);
    if (!attachment || !attachment.attachedTo) return;

    const host = findCard(this.state, attachment.attachedTo);
    if (host) {
      const idx = host.attachments.indexOf(attachmentId);
      if (idx >= 0) {
        host.attachments.splice(idx, 1);
      }
    }

    attachment.attachedTo = null;
  }

  async proliferate(player: PlayerId): Promise<void> {
    // Gather all permanents with counters and players with poison counters
    type ProliferateTarget = { kind: 'card'; card: CardInstance } | { kind: 'player'; playerId: PlayerId };
    const candidates: ProliferateTarget[] = [];

    for (const pid of this.state.turnOrder) {
      if (this.state.players[pid].hasLost) continue;
      for (const card of this.state.zones[pid].BATTLEFIELD) {
        const hasCounters = Object.values(card.counters).some(v => v > 0);
        if (hasCounters) {
          candidates.push({ kind: 'card', card });
        }
      }
      if (this.state.players[pid].poisonCounters > 0) {
        candidates.push({ kind: 'player', playerId: pid });
      }
    }

    if (candidates.length === 0) return;

    const choices = this.createChoiceHelper(player);
    const selected = await choices.chooseUpToN(
      'Proliferate: choose permanents and/or players to add counters to',
      candidates,
      candidates.length,
      (t) => {
        if (t.kind === 'card') return `${t.card.definition.name} (${Object.entries(t.card.counters).filter(([, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(', ')})`;
        return `${this.state.players[t.playerId].name} (${this.state.players[t.playerId].poisonCounters} poison)`;
      }
    );

    for (const target of selected) {
      if (target.kind === 'card') {
        // Add one counter of each type already on the permanent
        for (const [counterType, count] of Object.entries(target.card.counters)) {
          if (count > 0) {
            this.addCounters(target.card.objectId, counterType, 1, { player });
          }
        }
      } else {
        // Add one poison counter
        this.state.players[target.playerId].poisonCounters += 1;
      }
    }
  }

  transformPermanent(objectId: ObjectId): void {
    const card = findCard(this.state, objectId);
    if (!card || card.zone !== 'BATTLEFIELD') return;
    card.isTransformed = !card.isTransformed;
  }

  becomeMonarch(player: PlayerId): void {
    this.state.monarch = player;
  }

  becomeInitiativeHolder(player: PlayerId): void {
    this.state.initiativeHolder = player;
  }

  registerDelayedTrigger(trigger: DelayedTrigger): void {
    this.state.delayedTriggers.push(trigger);
  }

  async unlessPlayerPays(player: PlayerId, sourceId: ObjectId, cost: import('./types').PlainCost, prompt: string): Promise<boolean> {
    const source = findCard(this.state, sourceId);
    if (!source) return false;
    return this.payAuxiliaryCost(player, source, cost, prompt);
  }

  async sacrificePermanents(player: PlayerId, filter: CardFilter, count: number, prompt?: string): Promise<CardInstance[]> {
    const battlefield = this.state.zones[player].BATTLEFIELD.filter(card =>
      !card.phasedOut && this.matchesFilter(card, filter, player),
    );
    if (battlefield.length < count) return [];

    const helper = this.createChoiceHelper(player);
    const selected = count === 1
      ? [await helper.chooseOne(prompt ?? 'Choose a permanent to sacrifice', battlefield, card => card.definition.name)]
      : await helper.chooseN(prompt ?? `Choose ${count} permanents to sacrifice`, battlefield, count, card => card.definition.name);

    for (const card of selected) {
      this.sacrificePermanent(card.objectId, player);
    }

    return selected;
  }

  addPlayerCounters(player: PlayerId, counterType: 'experience' | 'energy', amount: number): void {
    const target = this.state.players[player];
    if (counterType === 'experience') {
      target.experienceCounters = (target.experienceCounters ?? 0) + amount;
    } else {
      target.energyCounters = (target.energyCounters ?? 0) + amount;
    }
  }

  removePlayerCounters(player: PlayerId, counterType: 'experience' | 'energy', amount: number): boolean {
    const target = this.state.players[player];
    const key = counterType === 'experience' ? 'experienceCounters' : 'energyCounters';
    const current = target[key] ?? 0;
    if (current < amount) return false;
    target[key] = current - amount;
    return true;
  }

  grantExtraTurn(player: PlayerId): void {
    if (!this.state.pendingExtraTurns) {
      this.state.pendingExtraTurns = [];
    }
    this.state.pendingExtraTurns.unshift(player);
  }

  grantExtraCombat(options: import('./types').PendingCombatPhase = {}): void {
    if (!this.state.pendingExtraCombatPhases) {
      this.state.pendingExtraCombatPhases = [];
    }
    this.state.pendingExtraCombatPhases.unshift({
      attackRestriction: options.attackRestriction,
    });
  }

  endTurn(): void {
    for (const entry of [...this.state.stack]) {
      if (entry.cardInstance) {
        this.zoneManager.moveCard(this.state, entry.cardInstance.objectId, 'EXILE', entry.cardInstance.owner);
      }
    }
    this.state.stack = [];
    this.state.combat = null;
    this.state.pendingExtraCombatPhases = [];
    this.state.currentCombatAttackRestriction = null;
    this.state.currentPhase = 'ENDING';
    this.state.currentStep = Step.CLEANUP;
    this.state.priorityPlayer = null;
    this.turnManager.forceCleanup(this.state, false);
  }

  // --- Private methods ---

  private async handlePassPriority(playerId: PlayerId): Promise<void> {
    const result = this.priorityManager.passPriority(this.state, playerId);

    if (result === 'resolve') {
      await this.resolveTopOfStack();
    } else if (result === 'advance') {
      this.handleStepTransitionActions();
      this.turnManager.advanceStep(this.state);
    }
    // 'continue' — priority passed to next player, runGameLoop will auto-pass if needed
  }

  private async handleMulliganKeep(playerId: PlayerId): Promise<void> {
    const mulliganState = this.state.mulliganState;
    if (!mulliganState || mulliganState.activePlayer !== playerId) return;

    const taken = mulliganState.taken[playerId] ?? 0;
    const bottomCount = Math.max(0, taken - 1);
    if (bottomCount > 0) {
      const hand = [...this.state.zones[playerId].HAND];
      const helper = this.createChoiceHelper(playerId);
      const selected = await helper.chooseN(
        `Choose ${bottomCount} card(s) to put on the bottom of your library`,
        hand,
        Math.min(bottomCount, hand.length),
        (card) => card.definition.name,
      );
      for (const card of selected) {
        this.putCardOnBottomOfLibrary(card.objectId, playerId);
      }
    }

    mulliganState.kept[playerId] = true;
    const nextPlayer = this.state.turnOrder.find((candidate) => !mulliganState.kept[candidate]);
    if (nextPlayer) {
      mulliganState.activePlayer = nextPlayer;
      this.state.priorityPlayer = nextPlayer;
      return;
    }

    delete this.state.mulliganState;
    this.state.priorityPlayer = this.state.activePlayer;
  }

  private handleMulliganTake(playerId: PlayerId): void {
    const mulliganState = this.state.mulliganState;
    if (!mulliganState || mulliganState.activePlayer !== playerId) return;

    mulliganState.taken[playerId] = (mulliganState.taken[playerId] ?? 0) + 1;

    const hand = [...this.state.zones[playerId].HAND];
    for (const card of hand) {
      this.putCardOnBottomOfLibrary(card.objectId, playerId);
    }
    this.zoneManager.shuffleLibrary(this.state, playerId);
    for (let i = 0; i < 7; i++) {
      this.zoneManager.drawCard(this.state, playerId);
    }
  }

  private handleDeclareAttackers(
    playerId: PlayerId,
    attackers: Array<{ attackerId: ObjectId; defendingPlayer?: PlayerId; defender?: import('./types').AttackTarget }>,
  ): void {
    const declarations = attackers.map((attacker) => ({
      attackerId: attacker.attackerId,
      defendingPlayer: attacker.defendingPlayer
        ?? (attacker.defender?.type === 'player' ? attacker.defender.id as PlayerId : undefined),
    })).filter((attacker): attacker is { attackerId: ObjectId; defendingPlayer: PlayerId } => Boolean(attacker.defendingPlayer));

    if (!this.payAttackTaxesIfNeeded(playerId, declarations)) {
      return;
    }

    const declared = this.combatManager.declareAttackers(this.state, attackers, true);
    if (declared) {
      this.priorityManager.playerTookAction(this.state, playerId);
    }
  }

  /** Perform step-specific actions when all players pass (before advancing) */
  private handleStepTransitionActions(): void {
    if (this.state.currentStep === Step.BEGINNING_OF_COMBAT) {
      this.combatManager.beginCombat(this.state);
    } else if (this.state.currentStep === Step.FIRST_STRIKE_DAMAGE) {
      this.combatManager.dealCombatDamage(this.state, true);
    } else if (this.state.currentStep === Step.COMBAT_DAMAGE) {
      this.combatManager.dealCombatDamage(this.state, false);
    } else if (this.state.currentStep === Step.END_OF_COMBAT) {
      this.combatManager.endCombat(this.state);
    }
  }

  private removePermanentFromCombat(objectId: ObjectId): void {
    if (!this.state.combat) return;

    this.state.combat.attackers.delete(objectId);
    this.state.combat.blockers.delete(objectId);
    this.state.combat.blockerOrder.delete(objectId);

    for (const [attackerId, blockerIds] of this.state.combat.blockerOrder) {
      const nextBlockers = blockerIds.filter((blockerId) => blockerId !== objectId);
      if (nextBlockers.length === 0) {
        this.state.combat.blockerOrder.delete(attackerId);
      } else {
        this.state.combat.blockerOrder.set(attackerId, nextBlockers);
      }
    }

    for (const [blockerId, attackerId] of [...this.state.combat.blockers.entries()]) {
      if (attackerId === objectId || blockerId === objectId) {
        this.state.combat.blockers.delete(blockerId);
      }
    }
  }

  private handlePlayLand(playerId: PlayerId, cardId: ObjectId, chosenFace?: 'front' | 'back'): void {
    const card = findCard(this.state, cardId);
    if (!card) return;
    if (!this.turnManager.canPlaySorcerySpeed(this.state, playerId)) return;

    const player = this.state.players[playerId];
    if (player.landsPlayedThisTurn >= player.landPlaysAvailable) return;

    if (chosenFace === 'back') {
      if (!card.definition.isMDFC || !card.definition.backFace?.types.includes(CardType.LAND)) return;
      card.isTransformed = true;
    } else if (!card.definition.types.includes(CardType.LAND)) {
      return;
    }

    // Move land from hand to battlefield
    this.zoneManager.moveCard(this.state, cardId, 'BATTLEFIELD', playerId);
    player.landsPlayedThisTurn++;
    player.hasPlayedLand = true;
  }

  private async handleCastSpell(
    playerId: PlayerId,
    cardId: ObjectId,
    targets?: (ObjectId | PlayerId)[],
    requestedModeChoices?: number[],
    xValue?: number,
    chosenFace?: 'front' | 'back',
    chosenHalf?: 'left' | 'right' | 'fused',
    requestedCastMethod?: string,
    castAsAdventure?: boolean,
  ): Promise<void> {
    const card = findCard(this.state, cardId);
    if (!card) return;

    const effectiveDef = this.getEffectiveSpellDefinition(card, {
      chosenFace,
      chosenHalf,
      castAsAdventure,
    });
    if (!effectiveDef) return;
    if (card.zone === Zone.EXILE && effectiveDef.types.includes(CardType.LAND)) return;
    if (!this.canCastWithCurrentTiming(playerId, effectiveDef, card.zone)) return;

    // Calculate cost (including commander tax and alternative costs)
    const player = this.state.players[playerId];
    let castMethod = requestedCastMethod;
    const castPermission = this.findCastPermission(card, playerId, castMethod);

    const matchingAltCost = castMethod
      ? card.definition.alternativeCosts?.find(
        ac => ac.zone === card.zone && ac.id === castMethod
      )
      : undefined;

    // Build the payment cost using the Cost class
    let paymentCost: Cost;
    if (castPermission) {
      paymentCost = this.mergePlainCosts(effectiveDef.cost, castPermission.alternativeCost);
      castMethod = this.getCastPermissionMethod(castPermission);
    } else if (matchingAltCost) {
      paymentCost = this.mergePlainCosts(effectiveDef.cost, matchingAltCost.cost);
    } else if (chosenHalf === 'fused' && card.definition.splitHalf) {
      paymentCost = Cost.from(card.definition.cost).combineWith(Cost.from(card.definition.splitHalf.cost));
    } else if (castAsAdventure && card.definition.adventure) {
      paymentCost = Cost.from(card.definition.adventure.cost);
    } else {
      paymentCost = Cost.from(effectiveDef.cost);
    }

    const isCommanderCast = card.zone === 'COMMAND' && player.commanderIds.includes(card.cardId);
    if (isCommanderCast) {
      const tax = (player.commanderTimesCast[card.cardId] ?? 0) * 2;
      paymentCost.addManaTax({ generic: tax });
    }

    // --- X Spell handling ---
    let resolvedX = xValue;
    const xManaSnapshot = paymentCost.getManaCostSnapshot();
    if (xManaSnapshot && xManaSnapshot.X > 0) {
      if (resolvedX === undefined) {
        const baseCost = manaCostTotal({ ...xManaSnapshot, X: 0 });
        const totalAvail = this.manaManager.totalAvailable(this.state, playerId);
        const battlefield = this.getBattlefield(undefined, playerId);
        let potentialMana = totalAvail;
        for (const c of battlefield) {
          if (c.tapped || c.controller !== playerId) continue;
          for (const ab of getEffectiveAbilities(c)) {
            if (ab.kind === 'activated' && ab.isManaAbility) {
              potentialMana++;
              break;
            }
          }
        }
        const maxX = Math.max(0, potentialMana - baseCost);
        const choices = this.createChoiceHelper(playerId);
        const xOptions = Array.from({ length: maxX + 1 }, (_, i) => i);
        resolvedX = await choices.chooseOne(
          `Choose value for X (0-${maxX})`,
          xOptions,
          (n) => String(n)
        );
      }
      paymentCost.resolveX(resolvedX ?? 0);
    }

    let additionalCostsPaid: string[] = [];
    if (card.definition.additionalCosts) {
      const additionalCostResult = await this.chooseAndPayAdditionalCosts(playerId, card, card.definition.additionalCosts, {
        excludeSourceFromHandDiscard: true,
      });
      if (!additionalCostResult) {
        return;
      }
      additionalCostsPaid = additionalCostResult.paidIds;
      paymentCost.addManaCostFrom(additionalCostResult.extraManaCost);
    }
    this.applyCastCostAdjustments(playerId, card, effectiveDef, paymentCost);

    // Pay non-mana parts of alternative cost (e.g., flashback exile)
    const alternatePlainCost = castPermission?.alternativeCost ?? matchingAltCost?.cost;
    if (alternatePlainCost) {
      const altCost = Cost.from(alternatePlainCost);
      const altCtx = this.createCostContext(playerId, card, { excludeSourceFromHandDiscard: true });
      if (!await altCost.payNonMana(altCtx)) {
        return;
      }
    }

    // Apply delve/convoke/generic tap substitution
    const modCtx = this.createCostContext(playerId, card);
    if (!await paymentCost.applyModifiers(modCtx)) {
      return;
    }

    if (!this.canAffordCostWithTapSubstitution(playerId, card, paymentCost)) {
      return;
    }

    const spell = effectiveDef.spell;
    let selectedModeChoices = requestedModeChoices ? [...requestedModeChoices] : undefined;
    let chosenTargetSpecs: import('./types').TargetSpec[] | undefined;
    if (spell?.kind === 'modal') {
      if (!selectedModeChoices) {
        const choices = this.createChoiceHelper(playerId);
        const modeLabels = spell.modes.map((m, i) => ({ label: m.label, index: i }));
        const selected = await choices.chooseN(
          `Choose ${spell.chooseCount} mode(s)`,
          modeLabels,
          spell.chooseCount,
          (m) => m.label,
          { allowDuplicates: spell.allowRepeatedModes },
        );
        selectedModeChoices = selected.map(m => m.index);
      }
      chosenTargetSpecs = selectedModeChoices.flatMap((modeIndex) => spell.modes[modeIndex]?.targets ?? []);
    } else if (castMethod === 'overload') {
      chosenTargetSpecs = [];
    }

    const activeTargetSpecs = chosenTargetSpecs ?? this.getTargetSpecs(effectiveDef) ?? [];
    let resolvedTargets = targets ? [...targets] : [];
    let targetGroupCounts: number[] | undefined;
    if (resolvedTargets.length === 0 && activeTargetSpecs.length > 0) {
      const chosenTargets = await this.chooseTargetsForSpecs(playerId, card, activeTargetSpecs);
      resolvedTargets = chosenTargets.targets;
      targetGroupCounts = chosenTargets.groupCounts;
    }

    if (activeTargetSpecs.length > 0) {
      if (!targetGroupCounts) {
        targetGroupCounts = this.groupTargetsBySpec(playerId, card, resolvedTargets, activeTargetSpecs) ?? undefined;
      }
      if (!targetGroupCounts) {
        return;
      }
    } else if (resolvedTargets.length > 0) {
      return;
    }

    if (effectiveDef.attachment?.type === 'Aura') {
      const targetId = resolvedTargets[0];
      if (typeof targetId === 'string' && !targetId.startsWith('player')) {
        card.attachedTo = targetId;
      }
    }

    // Pay mana via Cost class
    const payCtx = this.createCostContext(playerId, card, { spellDefinition: effectiveDef });
    const manaPaymentResult = paymentCost.payMana(payCtx);
    if (manaPaymentResult === false) return;

    if (resolvedTargets.length > 0) {
      const wardPaid = await this.payWardCostsIfNeeded(playerId, card, resolvedTargets);
      if (!wardPaid) return;
    }

    // Track commander casts
    if (isCommanderCast) {
      player.commanderTimesCast[card.cardId] = (player.commanderTimesCast[card.cardId] ?? 0) + 1;
    }

    if (castPermission) {
      this.state.castPermissions = this.state.castPermissions.filter((permission) =>
        !(permission.objectId === castPermission.objectId && permission.zoneChangeCounter === castPermission.zoneChangeCounter)
      );
    }

    // Put spell on the stack
    const stackEntry = this.stackManager.castSpell(
      this.state,
      card,
      playerId,
      resolvedTargets,
      resolvedX,
      effectiveDef,
    );
    if (manaPaymentResult) {
      this.applyTrackedManaToSpell(stackEntry, effectiveDef, manaPaymentResult.spentTrackedMana);
    }

    // Store alternative cost method and MDFC face on the stack entry
    if (castMethod) {
      stackEntry.castMethod = castMethod;
    }
    if (chosenFace) {
      stackEntry.chosenFace = chosenFace;
    }
    if (chosenHalf) {
      stackEntry.chosenHalf = chosenHalf;
    }
    if (castAsAdventure) {
      stackEntry.castAsAdventure = true;
    }
    if (additionalCostsPaid.length > 0) {
      stackEntry.additionalCostsPaid = additionalCostsPaid;
    }

    // --- Modal spell handling ---
    if (spell?.kind === 'modal') {
      stackEntry.modeChoices = selectedModeChoices;
      stackEntry.targetSpecs = chosenTargetSpecs;
    } else if (castMethod === 'overload') {
      stackEntry.targetSpecs = [];
    } else {
      stackEntry.targetSpecs = effectiveDef.spell?.kind === 'simple'
        ? effectiveDef.spell.targets
        : (effectiveDef.attachment?.type === 'Aura' ? [effectiveDef.attachment.target] : undefined);
    }
    stackEntry.targetGroupCounts = targetGroupCounts;

    await this.applyCastBehaviors(playerId, card, effectiveDef, stackEntry);

    this.priorityManager.playerTookAction(this.state, playerId);
  }

  private async handleActivateAbility(
    playerId: PlayerId,
    sourceId: ObjectId,
    abilityIndex: number,
    targets?: (ObjectId | PlayerId)[]
  ): Promise<void> {
    const card = findCard(this.state, sourceId);
    if (!card) return;

    const ability = getEffectiveAbilities(card)[abilityIndex];
    if (!ability || ability.kind !== 'activated') return;
    if (!this.canActivateActivatedAbility(card, ability, playerId, abilityIndex)) {
      return;
    }
    const paymentCost = Cost.from(ability.cost);
    const reservedTapSourceIds = paymentCost.requiresTap() ? new Set<ObjectId>([card.objectId]) : new Set<ObjectId>();

    if (targets && targets.length > 0) {
      if (!this.areChosenTargetsLegal(playerId, card, ability, targets)) {
        return;
      }
      const wardPaid = await this.payWardCostsIfNeeded(playerId, card, targets);
      if (!wardPaid) return;
    }

    if (!this.canAffordCostWithTapSubstitution(playerId, card, paymentCost, reservedTapSourceIds)) {
      return;
    }

    // Pay costs
    const ctx = this.createCostContext(playerId, card, { reservedTapSourceIds });
    await paymentCost.applyModifiers(ctx);
    const payResult = await paymentCost.pay(ctx);
    if (!payResult.success) return;

    if (ability.isExhaust) {
      if (!card.exhaustedAbilityZoneChangeCounters) {
        card.exhaustedAbilityZoneChangeCounters = {};
      }
      card.exhaustedAbilityZoneChangeCounters[abilityIndex] = card.zoneChangeCounter;
    }

    // Planeswalker loyalty ability tracking: mark this planeswalker as having used an ability
    const isPlaneswalker = hasType(card, CardType.PLANESWALKER as CardTypeEnum);
    if (isPlaneswalker) {
      if (!this.state.loyaltyAbilitiesUsedThisTurn) {
        this.state.loyaltyAbilitiesUsedThisTurn = [];
      }
      this.state.loyaltyAbilitiesUsedThisTurn.push(card.objectId);
    }

    // Mana abilities resolve immediately
    if (ability.isManaAbility) {
      const ctx = this.makeEffectContext({
        id: '',
        entryType: StackEntryType.ACTIVATED_ABILITY,
        sourceId,
        sourceCardId: card.cardId,
        sourceZoneChangeCounter: card.zoneChangeCounter,
        sourceSnapshot: card,
        controller: playerId,
        timestamp: 0,
        targets: targets ?? [],
        targetZoneChangeCounters: (targets ?? []).map((target) => {
          if (typeof target === 'string' && target.startsWith('player')) {
            return null;
          }
          return findCard(this.state, target)?.zoneChangeCounter ?? null;
        }),
        resolve: ability.effect,
      });
      ctx.source = card;
      await ability.effect(ctx);
      if (paymentCost.requiresTap() && hasType(card, CardType.CREATURE)) {
        this.emitTappedForManaEvent(playerId, card);
      }
    } else {
      this.stackManager.activateAbility(
        this.state, card, ability, playerId, targets ?? []
      );
      this.priorityManager.playerTookAction(this.state, playerId);
    }
  }

  private handleCommanderToCommandZone(playerId: PlayerId, cardId: ObjectId): void {
    const card = findCard(this.state, cardId);
    if (!card) return;
    if (!this.state.players[playerId].commanderIds.includes(card.cardId)) return;
    this.zoneManager.moveCard(this.state, cardId, 'COMMAND', playerId);
  }

  private async resolveTopOfStack(): Promise<void> {
    const makeCtx = (entry: StackEntry) => this.makeEffectContext(entry);
    await this.stackManager.resolveTop(this.state, makeCtx);
  }

  private async runGameLoop(): Promise<void> {
    let iterations = 0;
    const maxIterations = 500; // safety valve (higher because auto-pass loops more)

    while (iterations < maxIterations) {
      iterations++;

      if (await this.handleCleanupStep()) continue;

      if (this.processPendingFreeCasts()) continue;

      // 1. Check state-based actions
      if (this.sbaChecker.checkAndApply(this.state)) continue;

      // 2. Put triggered abilities on the stack
      if (await this.placePendingTriggers()) continue;

      // 3. Recalculate continuous effects
      this.continuousEffects.applyAll(this.state);

      // 4. Clean up any players who have lost before granting further priority
      if (this.processPlayerEliminations()) continue;

      // 5. Check game over
      if (this.checkGameOver()) break;

      // 6. Grant priority
      this.priorityManager.grantPriority(this.state);

      // 7. Auto-pass: if current priority holder has no meaningful actions,
      //    automatically pass priority for them (Arena-style)
      const priorityHolder = this.state.priorityPlayer;
      if (priorityHolder && !this.hasMeaningfulActions(priorityHolder)) {
        // Auto-pass for this player
        const result = this.priorityManager.passPriority(this.state, priorityHolder);

        if (result === 'resolve') {
          // All players passed with stack items — resolve top
          await this.resolveTopOfStack();
          continue; // Re-run game loop after resolution
        } else if (result === 'advance') {
          // All players passed with empty stack — handle step transitions and advance
          this.handleStepTransitionActions();
          this.turnManager.advanceStep(this.state);
          continue; // Re-run game loop for the new step
        } else {
          // 'continue' — passed to next player, loop again to check if they also auto-pass
          continue;
        }
      }

      // Priority holder has meaningful actions — stop and wait for player input
      break;
    }
  }

  private async placePendingTriggers(): Promise<boolean> {
    if (this.state.pendingTriggers.length === 0) return false;

    // Place triggers in APNAP order
    const apnap = this.priorityManager.getAPNAPOrder(this.state);
    const ordered: typeof this.state.pendingTriggers = [];
    for (const controller of apnap) {
      const controllerTriggers = this.state.pendingTriggers.filter((trigger) => trigger.controller === controller);
      if (controllerTriggers.length === 0) continue;
      if (controllerTriggers.length === 1) {
        ordered.push(controllerTriggers[0]);
        continue;
      }

      const helper = this.createChoiceHelper(controller);
      const chosenOrder = await helper.orderObjects(
        'Order your triggered abilities',
        controllerTriggers,
        (trigger) => `${trigger.source.definition.name}: ${trigger.ability.description}`,
      );
      ordered.push(...chosenOrder);
    }

    for (const trigger of ordered) {
      this.stackManager.putTriggeredAbility(
        this.state,
        trigger.source,
        trigger.ability,
        trigger.controller,
        trigger.event
      );
      if (trigger.delayedTriggerId) {
        this.state.delayedTriggers = this.state.delayedTriggers.filter(
          delayed => delayed.id !== trigger.delayedTriggerId,
        );
      }
    }

    this.state.pendingTriggers = [];
    return true;
  }

  private async handleCleanupStep(): Promise<boolean> {
    if (this.state.currentStep !== Step.CLEANUP) return false;
    if (this.state.stack.length > 0 || this.state.pendingTriggers.length > 0) return false;

    const activePlayer = this.state.activePlayer;
    const maxHandSize = this.getMaximumHandSize(activePlayer);
    const hand = this.state.zones[activePlayer].HAND;
    if (maxHandSize !== null && hand.length > maxHandSize) {
      const helper = this.createChoiceHelper(activePlayer);
      const discardCount = hand.length - maxHandSize;
      const selected = await helper.chooseN(
        `Choose ${discardCount} card(s) to discard`,
        [...hand],
        discardCount,
        (card) => card.definition.name,
      );
      for (const card of selected) {
        this.zoneManager.discardCard(this.state, activePlayer, card.objectId);
      }
      return true;
    }

    this.turnManager.forceCleanup(this.state, false);
    if (this.state.pendingTriggers.length === 0) {
      this.turnManager.advanceStep(this.state);
    }
    return true;
  }

  private getMaximumHandSize(playerId: PlayerId): number | null {
    const battlefield = this.state.zones[playerId].BATTLEFIELD;
    if (battlefield.some((card) =>
      getEffectiveAbilities(card).some((ability) =>
        ability.kind === 'static' && StaticAbility.from(ability).isNoMaxHandSize()
      )
    )) {
      return null;
    }
    return 7;
  }

  private processPlayerEliminations(): boolean {
    const newlyLost = this.getAllPlayers().filter((playerId) =>
      this.state.players[playerId].hasLost && !this.processedEliminations.has(playerId)
    );

    if (newlyLost.length === 0) return false;

    for (const playerId of newlyLost) {
      this.eliminatePlayer(playerId);
    }

    return true;
  }

  private eliminatePlayer(playerId: PlayerId): void {
    if (this.processedEliminations.has(playerId)) return;

    const previousTurnOrder = [...this.state.turnOrder];
    const wasActivePlayer = this.state.activePlayer === playerId;
    const commanderIds = [...this.state.players[playerId].commanderIds];

    this.processedEliminations.add(playerId);

    this.removeOwnedBattlefieldPermanents(playerId);
    this.removeControlledStackEntries(playerId);
    this.removeOwnedCardsFromZones(playerId);

    this.state.continuousEffects = this.state.continuousEffects.filter(
      effect => !this.effectBelongsToPlayer(effect.sourceId, playerId)
    );
    this.state.replacementEffects = this.state.replacementEffects.filter(
      effect => !this.effectBelongsToPlayer(effect.sourceId, playerId)
    );
    this.state.wouldEnterBattlefieldReplacementEffects = this.state.wouldEnterBattlefieldReplacementEffects.filter(
      effect => !this.effectBelongsToPlayer(effect.sourceId, playerId)
    );
    this.state.interactionHooks = this.state.interactionHooks.filter(
      hook => !this.effectBelongsToPlayer(hook.sourceId, playerId)
    );

    this.combatManager.removePlayerFromCombat(this.state, playerId);

    this.state.pendingTriggers = this.state.pendingTriggers.filter(
      trigger => trigger.controller !== playerId && trigger.source.owner !== playerId
    );
    this.state.pendingFreeCasts = (this.state.pendingFreeCasts ?? []).filter(
      pending => pending.playerId !== playerId
    );

    this.pendingChoice = null;
    this.state.waitingForChoice = false;

    if (this.state.monarch === playerId) {
      this.state.monarch = undefined;
    }
    if (this.state.initiativeHolder === playerId) {
      this.state.initiativeHolder = undefined;
    }

    this.state.passedPriority.delete(playerId);
    if (this.state.priorityPlayer === playerId) {
      this.state.priorityPlayer = null;
    }

    for (const pid of this.getAllPlayers()) {
      for (const commanderId of commanderIds) {
        delete this.state.players[pid].commanderDamageReceived[commanderId];
      }
    }

    this.pruneLastKnownInformation(playerId);
    this.removePlayerFromTurnOrder(playerId);

    if (wasActivePlayer && !this.state.isGameOver) {
      const nextActive = this.findNextSurvivingPlayer(previousTurnOrder, playerId);
      if (nextActive) {
        this.state.activePlayer = nextActive;
      }
      this.state.combat = null;
      this.state.priorityPlayer = null;
      this.state.passedPriority.clear();
    }
  }

  private checkGameOver(): boolean {
    const alive = this.state.turnOrder.filter(pid => !this.state.players[pid].hasLost);
    if (alive.length <= 1) {
      const winner = alive[0] ?? null;
      this.state.isGameOver = true;
      this.state.winner = winner;
      if (
        winner &&
        !this.state.eventLog.some((event) =>
          event.type === GameEventType.PLAYER_WON && event.player === winner
        )
      ) {
        const event: GameEvent = {
          type: GameEventType.PLAYER_WON,
          timestamp: getNextTimestamp(this.state),
          player: winner,
        };
        this.state.eventLog.push(event);
        this.eventBus.emit(event);
      }
      return true;
    }
    return false;
  }

  private markPlayerLost(playerId: PlayerId, reason: string): void {
    const player = this.state.players[playerId];
    if (player.hasLost) return;

    player.hasLost = true;
    const event: GameEvent = {
      type: GameEventType.PLAYER_LOST,
      timestamp: getNextTimestamp(this.state),
      player: playerId,
      reason,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  private removeOwnedBattlefieldPermanents(playerId: PlayerId): void {
    const ownedBattlefieldCards: CardInstance[] = [];

    for (const pid of this.getAllPlayers()) {
      for (const card of this.state.zones[pid].BATTLEFIELD) {
        if (card.owner === playerId) {
          ownedBattlefieldCards.push(card);
        }
      }
    }

    for (const card of ownedBattlefieldCards) {
      if (findCard(this.state, card.objectId, card.zoneChangeCounter)?.zone === 'BATTLEFIELD') {
        this.zoneManager.moveCard(this.state, card.objectId, 'GRAVEYARD', card.owner);
      }
    }
  }

  private removeControlledStackEntries(playerId: PlayerId): void {
    const controlledEntries = this.state.stack
      .filter(entry => entry.controller === playerId)
      .map(entry => entry.id);

    for (const entryId of controlledEntries) {
      this.stackManager.counterSpell(this.state, entryId);
    }
  }

  private removeOwnedCardsFromZones(playerId: PlayerId): void {
    for (const pid of this.getAllPlayers()) {
      for (const zone of Object.keys(this.state.zones[pid]) as Zone[]) {
        const cards = this.state.zones[pid][zone];
        this.state.zones[pid][zone] = cards.filter(card => card.owner !== playerId);
      }
    }
  }

  private removePlayerFromTurnOrder(playerId: PlayerId): void {
    this.state.turnOrder = this.state.turnOrder.filter(pid => pid !== playerId);
  }

  private findNextSurvivingPlayer(previousTurnOrder: PlayerId[], removedPlayerId: PlayerId): PlayerId | null {
    const removedIndex = previousTurnOrder.indexOf(removedPlayerId);
    if (removedIndex < 0) {
      return this.state.turnOrder.find(pid => !this.state.players[pid].hasLost) ?? null;
    }

    for (let offset = 1; offset <= previousTurnOrder.length; offset++) {
      const candidate = previousTurnOrder[(removedIndex + offset) % previousTurnOrder.length];
      if (candidate !== removedPlayerId && !this.state.players[candidate].hasLost) {
        return candidate;
      }
    }

    return null;
  }

  private effectBelongsToPlayer(sourceId: ObjectId, playerId: PlayerId): boolean {
    const liveSource = findCard(this.state, sourceId);
    if (liveSource) {
      return liveSource.owner === playerId || liveSource.controller === playerId;
    }

    return Object.values(this.state.lastKnownInformation).some((snapshot) =>
      snapshot.objectId === sourceId &&
      (snapshot.owner === playerId || snapshot.controller === playerId)
    );
  }

  private pruneLastKnownInformation(playerId: PlayerId): void {
    this.state.lastKnownInformation = Object.fromEntries(
      Object.entries(this.state.lastKnownInformation).filter(([, snapshot]) =>
        snapshot.owner !== playerId && snapshot.controller !== playerId
      )
    );
  }

  private getAllPlayers(): PlayerId[] {
    return Object.keys(this.state.players) as PlayerId[];
  }

  private makeEffectContext(entry: StackEntry): EffectContext {
    const source = entry.cardInstance
      ?? findCard(this.state, entry.sourceId, entry.sourceZoneChangeCounter)
      ?? getLastKnownInformation(this.state, entry.sourceId, entry.sourceZoneChangeCounter)
      ?? entry.sourceSnapshot;
    const targets = entry.targets.map((t, index) => {
      if (typeof t === 'string' && t.startsWith('player')) return t as PlayerId;
      return findCard(this.state, t as string, entry.targetZoneChangeCounters?.[index] ?? undefined) ?? null;
    }) as (CardInstance | PlayerId | null)[];

    const choices = this.createChoiceHelper(entry.controller);

    const ctx: EffectContext = {
      game: this,
      state: this.state,
      source: source!,
      controller: entry.controller,
      targets,
      event: entry.triggeringEvent,
      xValue: entry.xValue,
      castMethod: entry.castMethod,
      additionalCostsPaid: entry.additionalCostsPaid,
      choices,
      chooseTarget: async (spec) => {
        const results = await this.chooseTargetsForSource(entry.controller, source!, { ...spec, count: 1 });
        return results[0] ?? null;
      },
      chooseTargets: (spec) => this.chooseTargetsForSource(entry.controller, source!, spec),
    };

    return ctx;
  }

  private createChoiceHelper(controller: PlayerId): ChoiceHelper {
    return {
      chooseOne: <T>(prompt: string, options: T[], labelFn?: (t: T) => string): Promise<T> => {
        return new Promise<T>((resolve) => {
          const req: ChoiceRequest = {
            type: 'chooseOne',
            prompt: `[${this.state.players[controller].name}] ${prompt}`,
            options: options as unknown[],
            labelFn: labelFn as ((item: unknown) => string) | undefined,
            resolve: (result) => resolve(result as T),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },

      chooseN: <T>(
        prompt: string,
        options: T[],
        n: number,
        labelFn?: (t: T) => string,
        opts?: { allowDuplicates?: boolean },
      ): Promise<T[]> => {
        return new Promise<T[]>((resolve) => {
          const req: ChoiceRequest = {
            type: 'chooseN',
            prompt: `[${this.state.players[controller].name}] ${prompt}`,
            options: options as unknown[],
            count: n,
            allowDuplicates: opts?.allowDuplicates ?? false,
            labelFn: labelFn as ((item: unknown) => string) | undefined,
            resolve: (result) => resolve(result as T[]),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },

      chooseUpToN: <T>(prompt: string, options: T[], n: number, labelFn?: (t: T) => string): Promise<T[]> => {
        return new Promise<T[]>((resolve) => {
          const req: ChoiceRequest = {
            type: 'chooseUpToN',
            prompt: `[${this.state.players[controller].name}] ${prompt}`,
            options: options as unknown[],
            count: n,
            labelFn: labelFn as ((item: unknown) => string) | undefined,
            resolve: (result) => resolve(result as T[]),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },

      chooseYesNo: (prompt: string): Promise<boolean> => {
        return new Promise<boolean>((resolve) => {
          const req: ChoiceRequest = {
            type: 'chooseYesNo',
            prompt: `[${this.state.players[controller].name}] ${prompt}`,
            options: [true, false],
            resolve: (result) => resolve(result as boolean),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },

      chooseTargets: (spec: import('./types').TargetSpec): Promise<(CardInstance | PlayerId)[]> => {
        const candidates: (CardInstance | PlayerId)[] = [];
        const what = spec.what;

        // Gather card candidates from the battlefield
        const addBattlefieldCards = (typeFilter?: CardTypeEnum[]) => {
          for (const pid of this.state.turnOrder) {
            if (this.state.players[pid].hasLost) continue;
            for (const card of this.state.zones[pid].BATTLEFIELD) {
              if (card.phasedOut) continue;
              if (typeFilter && !typeFilter.some(t => hasType(card, t))) continue;
              candidates.push(card);
            }
          }
        };

        // Gather player candidates
        const addPlayers = () => {
          for (const pid of this.getActivePlayers()) {
            candidates.push(pid);
          }
        };

        switch (what) {
          case 'creature':
            addBattlefieldCards([CardType.CREATURE as CardTypeEnum]);
            break;
          case 'planeswalker':
            addBattlefieldCards([CardType.PLANESWALKER as CardTypeEnum]);
            break;
          case 'permanent':
            addBattlefieldCards();
            break;
          case 'player':
            addPlayers();
            break;
          case 'creature-or-player':
            addBattlefieldCards([CardType.CREATURE as CardTypeEnum]);
            addPlayers();
            break;
          case 'creature-or-planeswalker':
            addBattlefieldCards([CardType.CREATURE as CardTypeEnum, CardType.PLANESWALKER as CardTypeEnum]);
            break;
          case 'any':
            addBattlefieldCards([CardType.CREATURE as CardTypeEnum, CardType.PLANESWALKER as CardTypeEnum]);
            addPlayers();
            break;
          case 'spell':
            for (const entry of this.state.stack) {
              if (entry.cardInstance) candidates.push(entry.cardInstance);
            }
            break;
          case 'card-in-graveyard': {
            const graveyardZone = spec.zone ?? 'GRAVEYARD';
            for (const pid of this.state.turnOrder) {
              if (this.state.players[pid].hasLost) continue;
              for (const card of this.state.zones[pid][graveyardZone] ?? []) {
                candidates.push(card);
              }
            }
            break;
          }
        }

        // Apply controller filter
        const filtered = candidates.filter(candidate => {
          if (typeof candidate === 'string') {
            // Player target
            if (spec.controller === 'you') return candidate === controller;
            if (spec.controller === 'opponent') return candidate !== controller;
            return true;
          }
          // Card target
          if (candidate.zone === 'BATTLEFIELD' && candidate.phasedOut) return false;
          if (spec.controller === 'you') return candidate.controller === controller;
          if (spec.controller === 'opponent') return candidate.controller !== controller;
          // Apply CardFilter
          if (spec.filter && !this.matchesFilter(candidate, spec.filter, controller)) return false;
          // Apply custom predicate
          if (spec.custom && !spec.custom(candidate, this.state)) return false;
          return true;
        });

        if (filtered.length === 0) {
          return Promise.resolve([]);
        }

        const count = spec.count;
        const chooseFn = spec.upTo ? 'chooseUpToN' : 'chooseN';
        const actualCount = Math.min(count, filtered.length);

        return new Promise((resolve) => {
          const req: ChoiceRequest = {
            type: chooseFn,
            prompt: `[${this.state.players[controller].name}] Choose ${spec.upTo ? 'up to ' : ''}${count} target(s)`,
            options: filtered as unknown[],
            count: actualCount,
            labelFn: (item) => {
              if (typeof item === 'string') return this.state.players[item as PlayerId]?.name ?? String(item);
              return (item as CardInstance).definition.name;
            },
            resolve: (result) => resolve(result as (CardInstance | PlayerId)[]),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },

      orderObjects: <T>(prompt: string, objects: T[], labelFn?: (t: T) => string): Promise<T[]> => {
        return new Promise<T[]>((resolve) => {
          const req: ChoiceRequest = {
            type: 'orderObjects',
            prompt: `[${this.state.players[controller].name}] ${prompt}`,
            options: objects as unknown[],
            labelFn: labelFn as ((item: unknown) => string) | undefined,
            resolve: (result) => resolve(result as T[]),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },

      choosePlayer: (prompt: string, options: PlayerId[]): Promise<PlayerId> => {
        return new Promise<PlayerId>((resolve) => {
          const req: ChoiceRequest = {
            type: 'choosePlayer',
            prompt: `[${this.state.players[controller].name}] ${prompt}`,
            options: options as unknown[],
            labelFn: (p) => this.state.players[p as PlayerId]?.name ?? String(p),
            resolve: (result) => resolve(result as PlayerId),
          };
          this.pendingChoice = req;
          if (this.choiceRequestHandler) {
            this.choiceRequestHandler(req);
          }
        });
      },
    };
  }

  private chooseCommanderZoneReplacement(card: CardInstance, toZone: Zone): boolean {
    const destinationLabel = this.describeZone(toZone);
    return this.chooseYesNoImmediate(
      card.owner,
      `Move ${card.definition.name} to the command zone instead of ${destinationLabel}?`,
      true,
    );
  }

  private chooseYesNoImmediate(controller: PlayerId, prompt: string, fallback: boolean): boolean {
    if (!this.choiceRequestHandler) {
      return fallback;
    }

    let resolved = false;
    let result = fallback;
    const req: ChoiceRequest = {
      type: 'chooseYesNo',
      prompt: `[${this.state.players[controller].name}] ${prompt}`,
      options: [true, false],
      resolve: (value) => {
        resolved = true;
        result = Boolean(value);
      },
    };

    this.pendingChoice = req;
    this.choiceRequestHandler(req);
    this.pendingChoice = null;

    return resolved ? result : fallback;
  }

  private describeZone(zone: Zone): string {
    switch (zone) {
      case 'GRAVEYARD':
        return 'their graveyard';
      case 'EXILE':
        return 'exile';
      case 'HAND':
        return 'their hand';
      case 'LIBRARY':
        return 'their library';
      default:
        return zone.toLowerCase();
    }
  }

  private processPendingFreeCasts(): boolean {
    const pending = this.state.pendingFreeCasts;
    if (!pending || pending.length === 0) return false;

    const nextCast = pending.shift()!;
    const card = findCard(this.state, nextCast.objectId);
    if (!card || card.zone !== 'EXILE') {
      return pending.length > 0;
    }

    const effectiveDef = this.getEffectiveSpellDefinition(card, {});
    if (!effectiveDef) return pending.length > 0;

    const stackEntry = this.stackManager.castSpell(
      this.state,
      card,
      nextCast.playerId,
      [],
      0,
      effectiveDef,
    );
    stackEntry.castMethod = nextCast.reason;
    this.priorityManager.playerTookAction(this.state, nextCast.playerId);
    return true;
  }

  private async chooseAndPayAdditionalCosts(
    playerId: PlayerId,
    source: CardInstance,
    costs: import('./types').AdditionalCost[],
    options: { excludeSourceFromHandDiscard?: boolean } = {},
  ): Promise<{ paidIds: string[]; extraManaCost: Cost } | null> {
    const helper = this.createChoiceHelper(playerId);
    const paidIds: string[] = [];
    let extraManaCost = Cost.empty();

    for (const additionalCost of costs) {
      if (additionalCost.optional) {
        const payIt = await helper.chooseYesNo(`Pay additional cost ${additionalCost.description}?`);
        if (!payIt) continue;
      }
      const addCost = Cost.from(additionalCost.cost);
      const ctx = this.createCostContext(playerId, source, {
        excludeSourceFromHandDiscard: options.excludeSourceFromHandDiscard,
      });
      const paid = await addCost.payNonMana(ctx);
      if (!paid) {
        if (additionalCost.optional) {
          continue;
        }
        return null;
      }
      extraManaCost.addManaCostFrom(addCost);
      paidIds.push(additionalCost.id);
    }

    return { paidIds, extraManaCost };
  }

  private async applyCastBehaviors(
    playerId: PlayerId,
    card: CardInstance,
    definition: CardDefinition,
    stackEntry: StackEntry,
  ): Promise<void> {
    const behaviors = definition.spellCastBehaviors ?? [];

    if (behaviors.some((behavior) => behavior.kind === 'storm')) {
      const stormCount = Math.max(0, (this.state.players[playerId].spellsCastThisTurn ?? 1) - 1);
      for (let i = 0; i < stormCount; i++) {
        this.copySpellOnStack(stackEntry.id, playerId);
      }
    }

    if (behaviors.some((behavior) => behavior.kind === 'cascade')) {
      await this.handleCascade(playerId, definition);
    }
  }

  private async handleCascade(playerId: PlayerId, sourceDefinition: CardDefinition): Promise<void> {
    const library = this.state.zones[playerId].LIBRARY;
    const exiled: CardInstance[] = [];
    let found: CardInstance | null = null;
    const sourceManaValue = Cost.from(sourceDefinition.cost).getManaValue();

    while (library.length > 0) {
      const card = library[library.length - 1];
      this.zoneManager.moveCard(this.state, card.objectId, 'EXILE', playerId);
      exiled.push(card);

      if (card.definition.types.includes(CardType.LAND as CardTypeEnum)) {
        continue;
      }
      if (Cost.from(card.definition.cost).getManaValue() < sourceManaValue) {
        found = card;
        break;
      }
    }

    if (found) {
      await this.castWithoutPayingManaCost(found.objectId, playerId);
    }

    for (const card of exiled) {
      if (found && card.objectId === found.objectId) continue;
      this.putCardOnBottomOfLibrary(card.objectId, playerId);
    }
  }

  private putCardOnBottomOfLibrary(cardId: ObjectId, owner: PlayerId): void {
    this.zoneManager.moveCard(this.state, cardId, 'LIBRARY', owner);
    const library = this.state.zones[owner].LIBRARY;
    const moved = library.pop();
    if (moved) {
      library.unshift(moved);
    }
  }

  private canCastWithCurrentTiming(
    playerId: PlayerId,
    source: CardInstance | CardDefinition,
    zone: Zone,
  ): boolean {
    const definition = 'definitionId' in source ? source.definition : source;
    if (definition.types.includes(CardType.INSTANT)) {
      return true;
    }
    if (getTimingPermissionProfile(source, this.state, zone).canCastAsInstant) {
      return true;
    }
    return this.turnManager.canPlaySorcerySpeed(this.state, playerId);
  }

  private getCastPermissionMethod(permission: CastPermission): string {
    return `cast-permission:${permission.reason}`;
  }

  private findCastPermission(
    card: CardInstance,
    playerId: PlayerId,
    requestedCastMethod?: string,
  ): CastPermission | undefined {
    if (card.zone !== Zone.EXILE) {
      return undefined;
    }

    return this.state.castPermissions.find((permission) =>
      permission.objectId === card.objectId &&
      permission.zoneChangeCounter === card.zoneChangeCounter &&
      permission.zone === card.zone &&
      permission.castBy === playerId &&
      (requestedCastMethod === undefined || this.getCastPermissionMethod(permission) === requestedCastMethod)
    );
  }

  private mergePlainCosts(base?: import('./types').PlainCost, override?: import('./types').PlainCost): Cost {
    const baseCost = Cost.from(base);
    if (!override) {
      return baseCost;
    }
    return Cost.merge(baseCost, Cost.from(override));
  }

  private getCastCostForLegalAction(
    playerId: PlayerId,
    source: CardInstance,
    baseCost: Cost,
    definition: CardDefinition = source.definition,
  ): Cost | null {
    const mandatoryAdditionalCostResult = this.getMandatoryAdditionalCostPreview(playerId, source);
    if (!mandatoryAdditionalCostResult) {
      return null;
    }

    return this.getAdjustedCastCost(
      playerId,
      source,
      baseCost,
      definition,
      mandatoryAdditionalCostResult.extraManaCost,
    );
  }

  private getMandatoryAdditionalCostPreview(
    playerId: PlayerId,
    source: CardInstance,
  ): { extraManaCost: Cost } | null {
    let extraManaCost = Cost.empty();

    for (const additionalCost of source.definition.additionalCosts ?? []) {
      if (additionalCost.optional) {
        continue;
      }
      const addCost = Cost.from(additionalCost.cost);
      const ctx = this.createCostContext(playerId, source, {
        excludeSourceFromHandDiscard: true,
      });
      if (!addCost.canPay(ctx)) {
        return null;
      }
      extraManaCost.addManaCostFrom(addCost);
    }

    return { extraManaCost };
  }

  private canActivateActivatedAbility(
    card: CardInstance,
    ability: import('./types').ActivatedAbilityDef,
    playerId: PlayerId,
    abilityIndex: number,
  ): boolean {
    if ((ability.activationZone ?? Zone.BATTLEFIELD) !== card.zone) {
      return false;
    }

    if (ability.activateOnlyDuringYourTurn && this.state.activePlayer !== playerId) {
      return false;
    }

    if (
      ability.timing === 'sorcery' &&
      !this.turnManager.canPlaySorcerySpeed(this.state, playerId) &&
      !getTimingPermissionProfile(card, this.state, card.zone).canActivateAsInstant
    ) {
      return false;
    }

    const abilityCost = Cost.from(ability.cost);
    if (card.zone === Zone.BATTLEFIELD && abilityCost.requiresTap() && card.tapped) {
      return false;
    }

    if (
      card.zone === Zone.BATTLEFIELD &&
      abilityCost.requiresTap() &&
      hasType(card, CardType.CREATURE as CardTypeEnum) &&
      card.summoningSick &&
      !getActivationRuleProfile(card, this.state).ignoreTapSummoningSickness
    ) {
      return false;
    }

    // Only check non-mana preconditions here; mana affordability is checked
    // separately via canAffordCostWithTapSubstitution in the legal actions loop.
    const ctx = this.createCostContext(playerId, card);
    if (!abilityCost.canPayNonMana(ctx)) {
      return false;
    }

    if (!ability.isExhaust) {
      return true;
    }

    return card.exhaustedAbilityZoneChangeCounters?.[abilityIndex] !== card.zoneChangeCounter;
  }

  private getAdjustedCastCost(
    playerId: PlayerId,
    source: CardInstance,
    baseCost: Cost,
    definition: CardDefinition = source.definition,
    extraManaCost?: Cost,
  ): Cost {
    const adjusted = baseCost.clone();
    if (extraManaCost) {
      adjusted.addManaCostFrom(extraManaCost);
    }
    this.applyCastCostAdjustments(playerId, source, definition, adjusted);
    return adjusted;
  }

  private applyCastCostAdjustments(
    playerId: PlayerId,
    source: CardInstance,
    definition: CardDefinition,
    cost: Cost,
  ): void {
    for (const adjustment of definition.castCostAdjustments ?? []) {
      if (adjustment.kind !== 'affinity') continue;
      const matching = this.getBattlefield(undefined).filter((candidate) =>
        this.matchesFilter(candidate, adjustment.filter, playerId),
      ).length;
      cost.applyReduction({ generic: matching * adjustment.amount });
    }

    for (const permanent of this.getBattlefield(undefined)) {
      for (const ability of getEffectiveAbilities(permanent)) {
        if (ability.kind !== 'static') continue;
        const sa = StaticAbility.from(ability);
        if (!sa.isActive(this.state, permanent)) continue;
        const costMod = sa.getCostModification();
        if (!costMod) continue;
        const spellReference: CardInstance = {
          ...source,
          definition,
          modifiedTypes: [...definition.types],
          modifiedSubtypes: [...definition.subtypes],
          modifiedSupertypes: [...definition.supertypes],
        };
        if (!this.matchesSpellFilter(spellReference, costMod.filter, playerId, permanent.controller)) continue;
        cost.addManaTax(costMod.costDelta);
      }
    }
  }

  private matchesSpellFilter(
    spell: CardInstance,
    filter: CardFilter,
    casterId: PlayerId,
    sourceController: PlayerId,
  ): boolean {
    if (filter.controller === 'opponent' && casterId === sourceController) return false;
    if (filter.controller === 'you' && casterId !== sourceController) return false;

    if (filter.types && !filter.types.some((type) => hasType(spell, type))) return false;

    return this.matchesFilter(
      spell,
      { ...filter, controller: undefined, types: undefined },
      sourceController,
    );
  }

  private applyTrackedManaToSpell(
    stackEntry: StackEntry,
    spellDefinition: CardDefinition,
    spentTrackedMana: TrackedMana[],
  ): void {
    if (!spellDefinition.types.includes(CardType.CREATURE) || spellDefinition.subtypes.includes('Human')) {
      return;
    }

    for (const entry of spentTrackedMana) {
      const effect = entry.effect;
      if (!effect) {
        continue;
      }
      switch (effect.kind) {
        case 'etb-counter-on-non-human-creature':
          if (!stackEntry.entersBattlefieldWithCounters) {
            stackEntry.entersBattlefieldWithCounters = {};
          }
          stackEntry.entersBattlefieldWithCounters[effect.counterType] =
            (stackEntry.entersBattlefieldWithCounters[effect.counterType] ?? 0) + effect.amount;
          break;
      }
    }
  }

  private canAffordCostWithTapSubstitution(
    playerId: PlayerId,
    source: CardInstance,
    cost: Cost,
    reservedTapSourceIds: Set<ObjectId> = new Set(),
  ): boolean {
    const manaSnapshot = cost.getManaCostSnapshot();
    if (!manaSnapshot) {
      return true;
    }

    const substitution = cost.getGenericTapSubstitution();
    if (!substitution || manaSnapshot.generic <= 0 || substitution.amount <= 0) {
      const ctx = this.createCostContext(playerId, source, { reservedTapSourceIds });
      return cost.canAffordMana(ctx);
    }

    const maxSubstitutions = Math.min(substitution.amount, manaSnapshot.generic);
    const ctx = this.createCostContext(playerId, source, { reservedTapSourceIds });
    const candidates = this.getGenericTapSubstitutionCandidates(
      playerId,
      source,
      substitution,
      reservedTapSourceIds,
    );
    const battlefield = this.getBattlefield(undefined, playerId);
    const tappedForSubstitution = new Set<ObjectId>();

    const search = (index: number, tappedCount: number): boolean => {
      const adjustedCost = cost.withReducedGeneric(tappedCount);
      const availableBattlefield = battlefield.filter(
        (card) => !reservedTapSourceIds.has(card.objectId) && !tappedForSubstitution.has(card.objectId),
      );
      if (this.manaManager.canAffordWithManaProduction(this.state, playerId, adjustedCost, availableBattlefield)) {
        return true;
      }

      if (index >= candidates.length || tappedCount >= maxSubstitutions) {
        return false;
      }

      if (search(index + 1, tappedCount)) {
        return true;
      }

      tappedForSubstitution.add(candidates[index].objectId);
      const canAfford = search(index + 1, tappedCount + 1);
      tappedForSubstitution.delete(candidates[index].objectId);
      return canAfford;
    };

    return search(0, 0);
  }

  private getGenericTapSubstitutionCandidates(
    playerId: PlayerId,
    source: CardInstance,
    substitution: import('./types/costs').GenericTapSubstitution,
    reservedTapSourceIds: Set<ObjectId> = new Set(),
  ): CardInstance[] {
    return this.state.zones[playerId].BATTLEFIELD.filter((card) => {
      if (card.phasedOut || card.tapped) return false;
      if (card.objectId === source.objectId) return false;
      if (reservedTapSourceIds.has(card.objectId)) return false;
      if (!this.matchesFilter(card, substitution.filter, source.controller)) return false;
      if (
        !substitution.ignoreSummoningSickness &&
        hasType(card, CardType.CREATURE) &&
        card.summoningSick &&
        !getActivationRuleProfile(card, this.state).ignoreTapSummoningSickness
      ) {
        return false;
      }
      return true;
    });
  }

  private payAttackTaxesIfNeeded(
    playerId: PlayerId,
    declarations: Array<{ attackerId: ObjectId; defendingPlayer: PlayerId }>,
  ): boolean {
    const attackTaxCost = this.getAttackTaxCost(declarations);
    if (attackTaxCost.isEmpty()) {
      return true;
    }

    const taxMana = attackTaxCost.getDisplayMana();
    const battlefield = this.getBattlefield(undefined, playerId);
    const plan = this.manaManager.autoTapForCost(this.state, playerId, taxMana, battlefield);
    if (!plan) {
      return false;
    }
    this.applyAutoTapPlan(playerId, plan);
    return true;
  }

  private getAttackTaxCost(
    declarations: Array<{ attackerId: ObjectId; defendingPlayer: PlayerId }>,
  ): Cost {
    let totalCost = Cost.empty();

    for (const declaration of declarations) {
      const attacker = findCard(this.state, declaration.attackerId);
      if (!attacker) continue;

      for (const tax of attacker.attackTaxes ?? []) {
        if (tax.defender !== declaration.defendingPlayer) continue;
        totalCost.addManaCostFrom(Cost.from(tax.cost));
      }
    }

    return totalCost;
  }

  private async payWardCostsIfNeeded(
    playerId: PlayerId,
    source: CardInstance,
    targets: (ObjectId | PlayerId)[],
  ): Promise<boolean> {
    const targetObjects: CardInstance[] = [];
    const seen = new Set<string>();
    for (const targetId of targets) {
      if (typeof targetId !== 'string' || targetId.startsWith('player') || seen.has(targetId)) continue;
      seen.add(targetId);

      const target = findCard(this.state, targetId);
      if (!target || target.zone !== 'BATTLEFIELD' || target.phasedOut) continue;
      targetObjects.push(target);
    }

    const requirements = this.interactionEngine.collectTargetRequirements(
      this.state,
      source,
      playerId,
      targetObjects,
    );
    for (const requirement of requirements) {
      if (!await this.payAuxiliaryCost(playerId, source, requirement.cost, requirement.prompt)) {
        return false;
      }
    }
    return true;
  }

  private async payAuxiliaryCost(
    playerId: PlayerId,
    source: CardInstance,
    cost: import('./types').Cost,
    prompt?: string,
  ): Promise<boolean> {
    if (prompt) {
      const helper = this.createChoiceHelper(playerId);
      const confirmed = await helper.chooseYesNo(prompt);
      if (!confirmed) return false;
    }
    const paymentCost = Cost.from(cost);
    const ctx = this.createCostContext(playerId, source);
    if (!paymentCost.canAffordMana(ctx)) return false;
    await paymentCost.applyModifiers(ctx);
    const result = await paymentCost.pay(ctx);
    return result.success;
  }

  private applyAutoTapPlan(
    playerId: PlayerId,
    plan: ReturnType<ManaManager['autoTapForCost']>,
  ): void {
    if (!plan) {
      return;
    }

    for (const entry of plan) {
      const source = findCard(this.state, entry.sourceId);
      if (!source) continue;
      const sourceSnapshot = cloneCardInstance(source);
      if (entry.tap) {
        this.zoneManager.tapPermanent(this.state, entry.sourceId);
      }
      if (entry.sacrificeSelf) {
        this.sacrificePermanent(entry.sourceId, playerId);
      }
      for (const color of Object.keys(entry.mana) as Array<keyof ManaPool>) {
        const amount = entry.mana[color] ?? 0;
        if (amount > 0) {
          this.manaManager.addMana(this.state, playerId, color, amount, entry.trackedManaEffect
            ? {
              trackedMana: {
                sourceId: entry.sourceId,
                effect: entry.trackedManaEffect,
              },
            }
            : undefined);
        }
      }
      if (entry.tap && hasType(sourceSnapshot, CardType.CREATURE)) {
        this.emitTappedForManaEvent(playerId, sourceSnapshot);
      }
    }
  }

  private chooseTargetsForSource(
    controller: PlayerId,
    source: CardInstance,
    spec: import('./types').TargetSpec,
  ): Promise<(CardInstance | PlayerId)[]> {
    const choices = this.createChoiceHelper(controller);
    return choices.chooseTargets({
      ...spec,
      custom: (candidate, game) => {
        if (!this.canTargetObject(controller, source, candidate, spec)) return false;
        return spec.custom ? spec.custom(candidate, game) : true;
      },
    });
  }

  private async chooseTargetsForSpecs(
    controller: PlayerId,
    source: CardInstance,
    specs: import('./types').TargetSpec[],
  ): Promise<{ targets: (ObjectId | PlayerId)[]; groupCounts: number[] }> {
    const targets: (ObjectId | PlayerId)[] = [];
    const groupCounts: number[] = [];

    for (const spec of specs) {
      const chosen = await this.chooseTargetsForSource(controller, source, spec);
      groupCounts.push(chosen.length);
      for (const target of chosen) {
        if (typeof target === 'string') {
          targets.push(target);
        } else {
          targets.push(target.objectId);
        }
      }
    }

    return { targets, groupCounts };
  }

  private groupTargetsBySpec(
    controller: PlayerId,
    source: CardInstance,
    targets: (ObjectId | PlayerId)[],
    targetSpecs: import('./types').TargetSpec[],
  ): number[] | null {
    if (targetSpecs.length === 0) {
      return targets.length === 0 ? [] : null;
    }

    const recurse = (specIndex: number, targetIndex: number): number[] | null => {
      if (specIndex >= targetSpecs.length) {
        return targetIndex === targets.length ? [] : null;
      }

      const spec = targetSpecs[specIndex];
      const minCount = spec.upTo ? 0 : spec.count;
      const maxCount = Math.min(spec.count, targets.length - targetIndex);

      for (let take = maxCount; take >= minCount; take--) {
        let valid = true;
        for (let offset = 0; offset < take; offset++) {
          const target = targets[targetIndex + offset];
          const targetObj = typeof target === 'string' && target.startsWith('player')
            ? target as PlayerId
            : findCard(this.state, target as ObjectId);
          if (!targetObj) {
            valid = false;
            break;
          }
          if (!this.matchesTargetSpec(targetObj, spec, controller)) {
            valid = false;
            break;
          }
          if (!this.canTargetObject(controller, source, targetObj, spec)) {
            valid = false;
            break;
          }
        }

        if (!valid) {
          continue;
        }

        const remaining = recurse(specIndex + 1, targetIndex + take);
        if (remaining) {
          return [take, ...remaining];
        }
      }

      return null;
    };

    return recurse(0, 0);
  }

  private areChosenTargetsLegal(
    controller: PlayerId,
    source: CardInstance,
    definitionOrAbility: CardDefinition | AbilityDefinition,
    targets: (ObjectId | PlayerId)[],
    explicitTargetSpecs?: import('./types').TargetSpec[],
  ): boolean {
    const targetSpecs = explicitTargetSpecs ?? this.getTargetSpecs(definitionOrAbility);

    if (!targetSpecs || targetSpecs.length === 0) {
      return targets.length === 0;
    }

    return this.groupTargetsBySpec(controller, source, targets, targetSpecs) !== null;
  }

  private getTargetSpecs(
    definitionOrAbility: CardDefinition | AbilityDefinition,
  ): import('./types').TargetSpec[] | undefined {
    if ('types' in definitionOrAbility) {
      const spell = definitionOrAbility.spell;
      if (spell?.kind === 'simple' && spell.targets) {
        return spell.targets;
      }
      if (spell?.kind === 'modal') {
        return spell.modes[0]?.targets;
      }
      if (definitionOrAbility.attachment?.type === 'Aura') {
        return [definitionOrAbility.attachment.target];
      }
      return undefined;
    }

    return 'targets' in definitionOrAbility ? definitionOrAbility.targets : undefined;
  }

  private matchesTargetSpec(
    candidate: CardInstance | PlayerId,
    spec: import('./types').TargetSpec,
    controller: PlayerId,
  ): boolean {
    if (typeof candidate === 'string') {
      if (spec.what !== 'player' && spec.what !== 'creature-or-player' && spec.what !== 'any') return false;
      if (spec.controller === 'you') return candidate === controller;
      if (spec.controller === 'opponent') return candidate !== controller;
      return !this.state.players[candidate].hasLost;
    }

    if (candidate.zone === 'BATTLEFIELD' && candidate.phasedOut) return false;
    if (spec.controller === 'you' && candidate.controller !== controller) return false;
    if (spec.controller === 'opponent' && candidate.controller === controller) return false;

    const typeChecks: Record<string, boolean> = {
      creature: hasType(candidate, CardType.CREATURE),
      planeswalker: hasType(candidate, CardType.PLANESWALKER),
      permanent: candidate.zone === 'BATTLEFIELD',
      spell: candidate.zone === 'STACK',
      'card-in-graveyard': candidate.zone === (spec.zone ?? 'GRAVEYARD'),
      'creature-or-player': hasType(candidate, CardType.CREATURE),
      'creature-or-planeswalker': hasType(candidate, CardType.CREATURE) || hasType(candidate, CardType.PLANESWALKER),
      any: candidate.zone === 'BATTLEFIELD',
    };
    if (!typeChecks[spec.what]) return false;
    if (spec.filter && !this.matchesFilter(candidate, spec.filter, controller)) return false;
    if (spec.custom && !spec.custom(candidate, this.state)) return false;
    return true;
  }

  private canTargetObject(
    controller: PlayerId,
    source: CardInstance,
    candidate: CardInstance | PlayerId,
    spec?: import('./types').TargetSpec,
  ): boolean {
    if (typeof candidate === 'string') {
      return !this.state.players[candidate].hasLost;
    }

    if (candidate.zone === 'BATTLEFIELD' && candidate.phasedOut) return false;
    return this.interactionEngine.canChooseTarget(this.state, source, controller, candidate, spec);
  }

  private getEffectiveSpellDefinition(
    card: CardInstance,
    opts: {
      chosenFace?: 'front' | 'back';
      chosenHalf?: 'left' | 'right' | 'fused';
      castAsAdventure?: boolean;
    },
  ): CardDefinition | undefined {
    if (opts.castAsAdventure && card.definition.adventure) {
      return {
        ...card.definition,
        name: card.definition.adventure.name,
        cost: Cost.from(card.definition.adventure.cost).toPlainCost(),
        types: [...card.definition.adventure.types],
        spell: {
          kind: 'simple',
          effect: card.definition.adventure.effect,
          description: card.definition.adventure.name,
        },
      };
    }
    if (opts.chosenFace === 'back' && card.definition.isMDFC && card.definition.backFace) {
      return card.definition.backFace;
    }
    if (opts.chosenHalf === 'right' && card.definition.splitHalf) {
      return card.definition.splitHalf;
    }
    if (opts.chosenHalf === 'fused' && card.definition.splitHalf) {
      return {
        ...card.definition,
        types: Array.from(new Set([...card.definition.types, ...card.definition.splitHalf.types])),
      };
    }
    return card.definition;
  }

  private matchesFilter(card: CardInstance, filter: CardFilter, sourceController?: PlayerId): boolean {
    if (card.zone === 'BATTLEFIELD' && card.phasedOut) return false;
    if (filter.types && !filter.types.some(t => hasType(card, t))) return false;
    if (filter.subtypes && !filter.subtypes.some(t => getEffectiveSubtypes(card).includes(t))) return false;
    if (filter.supertypes && !filter.supertypes.some(t => getEffectiveSupertypes(card).includes(t))) return false;
    if (filter.colors && !filter.colors.some(c => card.definition.colorIdentity.includes(c))) return false;
    if (filter.controller === 'you' && sourceController && card.controller !== sourceController) return false;
    if (filter.controller === 'opponent' && sourceController && card.controller === sourceController) return false;
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.self === true && sourceController && card.controller !== sourceController) return false;
    if (filter.tapped === true && !card.tapped) return false;
    if (filter.tapped === false && card.tapped) return false;
    if (filter.isToken === true && !card.isToken) return false;
    if (filter.power) {
      const p = card.modifiedPower ?? card.definition.power ?? 0;
      if (filter.power.op === 'lte' && p > filter.power.value) return false;
      if (filter.power.op === 'gte' && p < filter.power.value) return false;
      if (filter.power.op === 'eq' && p !== filter.power.value) return false;
    }
    if (filter.toughness) {
      const t = card.modifiedToughness ?? card.definition.toughness ?? 0;
      if (filter.toughness.op === 'lte' && t > filter.toughness.value) return false;
      if (filter.toughness.op === 'gte' && t < filter.toughness.value) return false;
      if (filter.toughness.op === 'eq' && t !== filter.toughness.value) return false;
    }
    if (filter.custom && !filter.custom(card, this.state)) return false;
    return true;
  }

  private createCostContext(
    playerId: PlayerId,
    source: CardInstance,
    options?: {
      reservedTapSourceIds?: Set<ObjectId>;
      excludeSourceFromHandDiscard?: boolean;
      spellDefinition?: CardDefinition;
    },
  ): CostContext {
    return {
      game: this.state,
      source,
      playerId,
      choices: this.createChoiceHelper(playerId),
      loseLife: (player, amount) => this.loseLife(player, amount),
      sacrificePermanent: (objectId, controller) => this.sacrificePermanent(objectId, controller),
      sacrificePermanents: (player, filter, count, prompt) => this.sacrificePermanents(player, filter, count, prompt),
      removeCounters: (objectId, counterType, amount) => this.removeCounters(objectId, counterType, amount),
      moveCard: (objectId, toZone, toOwner) => this.zoneManager.moveCard(this.state, objectId, toZone as any, toOwner),
      discardCard: (player, objectId) => this.zoneManager.discardCard(this.state, player, objectId),
      tapPermanent: (objectId) => this.zoneManager.tapPermanent(this.state, objectId),
      matchesFilter: (card, filter, controller) => this.matchesFilter(card, filter, controller),
      getBattlefield: (filter, controller) => this.getBattlefield(filter, controller),
      hasType: (card, type) => hasType(card, type),
      canPayMana: (player, cost) => this.manaManager.canPayMana(this.state, player, cost),
      payMana: (player, cost) => this.manaManager.payMana(this.state, player, cost),
      payManaWithContext: (player, cost, context) => this.manaManager.payManaWithContext(this.state, player, cost, context),
      autoTapForCost: (player, cost, battlefield) => this.manaManager.autoTapForCost(this.state, player, cost, battlefield),
      canAffordWithManaProduction: (player, cost, battlefield) => this.manaManager.canAffordWithManaProduction(this.state, player, cost, battlefield),
      applyAutoTapPlan: (pid, plan) => this.applyAutoTapPlan(pid, plan),
      reservedTapSourceIds: options?.reservedTapSourceIds,
      excludeSourceFromHandDiscard: options?.excludeSourceFromHandDiscard,
      spellDefinition: options?.spellDefinition,
    };
  }

  private notifyStateChange(): void {
    for (const listener of this.stateChangeListeners) {
      listener(this.state);
    }
  }
}
