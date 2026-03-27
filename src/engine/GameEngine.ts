import type {
  GameState, PlayerId, ObjectId, CardInstance, CardDefinition,
  CardFilter, ManaPool, ManaCost, EffectContext,
  StackEntry, GameEvent, PlayerAction, ProtectionFrom,
  GameEngine as IGameEngine, CardType as CardTypeEnum,
  ModalAbilityDef, AbilityDefinition, EffectDuration, ContinuousEffect,
  Layer as LayerType, Cost, DelayedTrigger, PredefinedTokenType, SearchLibraryOptions,
  AttackTarget, AlternativeCast,
} from './types';
import {
  GameEventType, ActionType, CardType, Step, Zone,
  StackEntryType, manaCostTotal, Layer, emptyManaCost, Keyword,
} from './types';
import { v4 as uuid } from 'uuid';
import {
  createCardInstance,
  createInitialGameState,
  drawInitialHands,
  findCard,
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
import type { ChoiceHelper } from './types';

export type GameEventCallback = (event: GameEvent) => void;
export type StateChangeCallback = (state: GameState) => void;
export type ChoiceRequest = {
  type: 'chooseOne' | 'chooseN' | 'chooseUpToN' | 'chooseYesNo' | 'choosePlayer' | 'orderObjects';
  prompt: string;
  options: unknown[];
  count?: number;
  labelFn?: (item: unknown) => string;
  resolve: (result: unknown) => void;
};

export interface GameEngineInit {
  decks?: DeckConfig[];
  initialState?: GameState;
  drawOpeningHands?: boolean;
  runGameLoopOnInit?: boolean;
}

interface NonManaCostPaymentResult {
  paid: boolean;
  returnedCards: CardInstance[];
  returnedAttackerDefender?: AttackTarget;
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
    keywords: [],
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
    keywords: [],
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
    keywords: [],
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
    keywords: [],
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
    this.stackManager = new StackManager(this.eventBus, this.zoneManager, this.manaManager);
    this.sbaChecker = new StateBasedActions(this.zoneManager, this.eventBus);
    this.combatManager = new CombatManager(this.eventBus, this.zoneManager, this.manaManager);
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
        this.priorityManager.startPriorityRound(this.state, this.state.activePlayer);
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
          const ability = card.definition.abilities[a.abilityIndex];
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
    if (isSorcerySpeed && !player.hasPlayedLand && player.landsPlayedThisTurn < player.landPlaysAvailable) {
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

      if (
        this.canCastThisWay(playerId, card, { spellDefinition: card.definition }) &&
        this.manaManager.canAffordWithManaProduction(this.state, playerId, card.definition.manaCost)
      ) {
        actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
      }

      if (card.definition.adventure) {
        const adventure = card.definition.adventure;
        if (this.canCastThisWay(playerId, card, { spellDefinition: adventure, castAsAdventure: true }) &&
          this.manaManager.canAffordWithManaProduction(this.state, playerId, adventure.manaCost)) {
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
          if (isSorcerySpeed && !player.hasPlayedLand && player.landsPlayedThisTurn < player.landPlaysAvailable) {
            actions.push({ type: ActionType.PLAY_LAND, playerId, cardId: card.objectId, chosenFace: 'back' });
          }
        } else {
          // Back face is a spell
          if (this.canCastThisWay(playerId, card, { spellDefinition: back, chosenFace: 'back' })) {
            if (this.manaManager.canAffordWithManaProduction(this.state, playerId, back.manaCost)) {
              actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, chosenFace: 'back' });
            }
          }
        }
      }

      for (const altCost of card.definition.alternativeCosts ?? []) {
        if (
          this.canCastThisWay(playerId, card, { spellDefinition: card.definition, castMethod: altCost.id }) &&
          (!altCost.cost.mana || this.manaManager.canAffordWithManaProduction(this.state, playerId, altCost.cost.mana))
        ) {
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
      if (this.canCastThisWay(playerId, card, { spellDefinition: right, chosenHalf: 'right' })) {
        if (this.manaManager.canAffordWithManaProduction(this.state, playerId, right.manaCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, chosenHalf: 'right' });
        }
      }

      // Fuse: cast both halves as one spell (sorcery speed only)
      if (card.definition.hasFuse && this.canCastThisWay(playerId, card, { spellDefinition: card.definition, chosenHalf: 'fused' })) {
        const fusedCost: ManaCost = {
          generic: card.definition.manaCost.generic + right.manaCost.generic,
          W: card.definition.manaCost.W + right.manaCost.W,
          U: card.definition.manaCost.U + right.manaCost.U,
          B: card.definition.manaCost.B + right.manaCost.B,
          R: card.definition.manaCost.R + right.manaCost.R,
          G: card.definition.manaCost.G + right.manaCost.G,
          C: card.definition.manaCost.C + right.manaCost.C,
          X: card.definition.manaCost.X + right.manaCost.X,
        };
        if (this.manaManager.canAffordWithManaProduction(this.state, playerId, fusedCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, chosenHalf: 'fused' });
        }
      }
    }

    // Cast spells from graveyard via alternative costs (e.g. flashback, escape)
    const graveyard = this.state.zones[playerId].GRAVEYARD;
    for (const card of graveyard) {
      if (!card.definition.alternativeCosts) continue;
      for (const altCost of card.definition.alternativeCosts) {
        if (
          this.canCastThisWay(playerId, card, { spellDefinition: card.definition, castMethod: altCost.id }) &&
          altCost.cost.mana &&
          this.manaManager.canAffordWithManaProduction(this.state, playerId, altCost.cost.mana)
        ) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId, castMethod: altCost.id });
        }
      }
    }

    // Cast commander from command zone
    const commandZone = this.state.zones[playerId].COMMAND;
    for (const card of commandZone) {
      if (player.commanderIds.includes(card.cardId)) {
        const tax = (player.commanderTimesCast[card.cardId] ?? 0) * 2;
        const totalCost = { ...card.definition.manaCost, generic: card.definition.manaCost.generic + tax };
        if (
          this.canCastThisWay(playerId, card, { spellDefinition: card.definition }) &&
          this.manaManager.canAffordWithManaProduction(this.state, playerId, totalCost)
        ) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }
    }

    // Cast creature portion of adventure cards from exile
    const exile = this.state.zones[playerId].EXILE;
    for (const card of exile) {
      if (card.castAsAdventure && card.definition.adventure) {
        // Can cast the creature portion from exile
        if (
          this.canCastThisWay(playerId, card, { spellDefinition: card.definition }) &&
          this.manaManager.canAffordWithManaProduction(this.state, playerId, card.definition.manaCost)
        ) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }
    }

    const activatableZones: Array<{ zone: Zone; cards: CardInstance[] }> = [
      { zone: Zone.BATTLEFIELD, cards: this.state.zones[playerId].BATTLEFIELD },
      { zone: Zone.HAND, cards: this.state.zones[playerId].HAND },
      { zone: Zone.GRAVEYARD, cards: this.state.zones[playerId].GRAVEYARD },
    ];
    for (const { zone, cards } of activatableZones) {
      for (const card of cards) {
        const isPlaneswalker = zone === Zone.BATTLEFIELD && card.definition.types.includes(CardType.PLANESWALKER as CardTypeEnum);
        const loyaltyUsed = isPlaneswalker &&
          (this.state.loyaltyAbilitiesUsedThisTurn ?? []).includes(card.objectId);

        for (let i = 0; i < card.definition.abilities.length; i++) {
          const ability = card.definition.abilities[i];
          if (ability.kind !== 'activated') continue;
          if ((ability.activationZone ?? Zone.BATTLEFIELD) !== zone) continue;
          if (ability.timing === 'sorcery' && !isSorcerySpeed) continue;
          if (zone === Zone.BATTLEFIELD && ability.cost.tap && card.tapped) continue;
          if (zone === Zone.BATTLEFIELD && ability.cost.tap && card.summoningSick && !card.definition.keywords.includes('Haste' as Keyword)) continue;
          if (ability.cost.mana && !this.manaManager.canAffordWithManaProduction(this.state, playerId, ability.cost.mana)) continue;
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

  private canCastThisWay(
    playerId: PlayerId,
    card: CardInstance,
    opts: {
      spellDefinition: Pick<CardDefinition, 'types'> & { keywords?: Keyword[] };
      castMethod?: string;
      castAsAdventure?: boolean;
      chosenFace?: 'front' | 'back';
      chosenHalf?: 'left' | 'right' | 'fused';
    },
  ): boolean {
    if (this.state.priorityPlayer !== playerId) return false;
    if (!this.isCastZoneLegal(playerId, card, opts)) return false;

    const alternativeCast = opts.castMethod ? this.findAlternativeCast(card, opts.castMethod) : undefined;
    if (opts.castMethod && !alternativeCast) {
      return false;
    }

    if (alternativeCast?.available) {
      return alternativeCast.available(this.state, card, playerId);
    }

    return this.canCastAtDefaultTiming(playerId, opts.spellDefinition);
  }

  private canCastAtDefaultTiming(
    playerId: PlayerId,
    spellDefinition: Pick<CardDefinition, 'types'> & { keywords?: Keyword[] },
  ): boolean {
    const isInstant = spellDefinition.types.includes(CardType.INSTANT as CardTypeEnum);
    const hasFlash = (spellDefinition.keywords ?? []).includes('Flash' as Keyword);
    return isInstant || hasFlash || this.turnManager.canPlaySorcerySpeed(this.state, playerId);
  }

  private findAlternativeCast(card: CardInstance, castMethod: string): AlternativeCast | undefined {
    return card.definition.alternativeCosts?.find(
      (alternativeCast) => alternativeCast.zone === card.zone && alternativeCast.id === castMethod,
    );
  }

  private isCastZoneLegal(
    playerId: PlayerId,
    card: CardInstance,
    opts: {
      castMethod?: string;
      castAsAdventure?: boolean;
    },
  ): boolean {
    if (opts.castMethod) {
      return this.findAlternativeCast(card, opts.castMethod) != null;
    }

    if (opts.castAsAdventure) {
      return card.zone === Zone.HAND && !!card.definition.adventure;
    }

    if (card.zone === Zone.HAND) return true;
    if (card.zone === Zone.COMMAND) {
      return this.state.players[playerId].commanderIds.includes(card.cardId);
    }
    if (card.zone === Zone.EXILE) {
      return Boolean(card.castAsAdventure && card.definition.adventure);
    }
    return false;
  }

  // --- IGameEngine implementation ---

  drawCards(player: PlayerId, count: number): void {
    this.zoneManager.drawCards(this.state, player, count);
  }

  addMana(player: PlayerId, color: keyof ManaPool, amount: number): void {
    this.manaManager.addMana(this.state, player, color, amount);
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

    // 3A: Protection check — if the target has protection from the source's color/type, prevent damage
    if (source) {
      const isPlayerTarget = typeof targetId === 'string' && targetId.startsWith('player');
      if (!isPlayerTarget) {
        const target = findCard(this.state, targetId as string);
        if (target && this.hasProtectionFrom(target, source)) return;
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

      if (source && source.definition.keywords.includes('Lifelink' as Keyword)) {
        this.gainLife(source.controller, finalAmount);
      }
    } else {
      const target = findCard(this.state, targetId as string);
      if (!target || target.zone !== 'BATTLEFIELD') return;
      if (target.definition.types.includes(CardType.PLANESWALKER as CardTypeEnum)) {
        target.counters['loyalty'] = (target.counters['loyalty'] ?? target.definition.loyalty ?? 0) - finalAmount;
      } else if (target.definition.types.includes(CardType.BATTLE as CardTypeEnum)) {
        target.counters.defense = Math.max(0, (target.counters.defense ?? target.definition.defense ?? 0) - finalAmount);
      } else {
        target.markedDamage += finalAmount;
        if (source && source.definition.keywords.includes('Deathtouch' as Keyword)) {
          target.counters['deathtouch-damage'] = 1;
        }
      }

      if (source && source.definition.keywords.includes('Lifelink' as Keyword)) {
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
    if (card.definition.keywords.includes('Indestructible' as Keyword)) return;
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
    this.zoneManager.moveCard(this.state, objectId, toZone, toOwner);
  }

  createToken(controller: PlayerId, definition: Partial<CardDefinition>): CardInstance {
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

  addCounters(objectId: ObjectId, counterType: string, amount: number): void {
    const card = findCard(this.state, objectId);
    if (!card) return;
    card.counters[counterType] = (card.counters[counterType] ?? 0) + amount;

    const event: GameEvent = {
      type: GameEventType.COUNTER_ADDED,
      timestamp: getNextTimestamp(this.state),
      objectId,
      counterType,
      amount,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);
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
    const original = findCard(this.state, objectId);
    if (!original || original.zone !== 'BATTLEFIELD') return undefined;

    // Create a token that copies the target permanent's definition
    const tokenDef: CardDefinition = {
      ...original.definition,
      id: `copy-${original.definition.id}-${Date.now()}`,
    };

    const token = createCardInstance(tokenDef, controller, 'BATTLEFIELD', getNextTimestamp(this.state));
    token.controller = controller;
    token.copyOf = original.objectId;

    this.state.zones[controller].BATTLEFIELD.push(token);

    // Set loyalty counters for planeswalker copies
    if (tokenDef.types.includes(CardType.PLANESWALKER as CardTypeEnum) && tokenDef.loyalty !== undefined) {
      token.counters['loyalty'] = tokenDef.loyalty;
    }

    const event: GameEvent = {
      type: GameEventType.ENTERS_BATTLEFIELD,
      timestamp: getNextTimestamp(this.state),
      objectId: token.objectId,
      controller,
    };
    this.state.eventLog.push(event);
    this.eventBus.emit(event);

    const triggers = this.eventBus.checkTriggers(event, this.state);
    for (const t of triggers) {
      this.state.pendingTriggers.push(t);
    }

    return token;
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
    if (card.definition.types.includes(CardType.PLANESWALKER as CardTypeEnum) || card.definition.types.includes(CardType.BATTLE as CardTypeEnum)) {
      this.removeAttackersDefendingTarget(card.objectId);
    }
    if (card.definition.types.includes(CardType.BATTLE as CardTypeEnum)) {
      card.battleProtector = this.chooseDefaultBattleProtector(newController);
    }

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
    const spellAbility = card.definition.abilities.find(a => a.kind === 'modal') as ModalAbilityDef | undefined;
    if (spellAbility) {
      const choices = this.createChoiceHelper(controller);
      const modeLabels = spellAbility.modes.map((m, i) => ({ label: m.label, index: i }));
      const selected = await choices.chooseN(
        `Choose ${spellAbility.chooseCount} mode(s)`,
        modeLabels,
        spellAbility.chooseCount,
        (m) => m.label
      );
      stackEntry.modeChoices = selected.map(m => m.index);
      stackEntry.ability = spellAbility;
      stackEntry.targetSpecs = stackEntry.modeChoices.flatMap((modeIndex) => spellAbility.modes[modeIndex]?.targets ?? []);
    }

    await this.applyCastKeywordEffects(controller, card, card.definition, stackEntry);
    this.priorityManager.playerTookAction(this.state, controller);
  }

  createEmblem(controller: PlayerId, abilities: AbilityDefinition[], description: string): CardInstance {
    const emblemDef: CardDefinition = {
      id: `emblem-${description.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      name: description,
      manaCost: emptyManaCost(),
      colorIdentity: [],
      types: [],
      supertypes: [],
      subtypes: [],
      abilities,
      keywords: [],
    };

    const instance = createCardInstance(emblemDef, controller, 'COMMAND', getNextTimestamp(this.state));
    instance.controller = controller;
    this.state.zones[controller].COMMAND.push(instance);

    return instance;
  }

  // --- Keyword Actions ---

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
    if (card.zone === 'BATTLEFIELD') {
      this.removePermanentFromCombat(card.objectId);
      if (card.definition.types.includes(CardType.PLANESWALKER as CardTypeEnum) || card.definition.types.includes(CardType.BATTLE as CardTypeEnum)) {
        this.removeAttackersDefendingTarget(card.objectId);
      }
    }
    this.zoneManager.moveCard(this.state, objectId, 'HAND', card.owner);
  }

  attachPermanent(attachmentId: ObjectId, hostId: ObjectId): void {
    const attachment = findCard(this.state, attachmentId);
    const host = findCard(this.state, hostId);
    if (!attachment || !host) return;
    if (attachment.zone !== 'BATTLEFIELD' || host.zone !== 'BATTLEFIELD') return;
    if (attachment.phasedOut || host.phasedOut) return;
    if (attachment.definition.attachmentType === 'Equipment' && !host.definition.types.includes(CardType.CREATURE as CardTypeEnum)) return;
    if (attachment.definition.attachmentType === 'Aura' && attachment.definition.attachTarget) {
      if (!this.matchesTargetSpec(host, attachment.definition.attachTarget, attachment.controller)) return;
    }
    if (this.hasProtectionFrom(host, attachment)) return;

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
            this.addCounters(target.card.objectId, counterType, 1);
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

  async unlessPlayerPays(player: PlayerId, sourceId: ObjectId, cost: Cost, prompt: string): Promise<boolean> {
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

  endTurn(): void {
    for (const entry of [...this.state.stack]) {
      if (entry.cardInstance) {
        this.zoneManager.moveCard(this.state, entry.cardInstance.objectId, 'EXILE', entry.cardInstance.owner);
      }
    }
    this.state.stack = [];
    this.state.combat = null;
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
      defender: attacker.defender
        ?? (attacker.defendingPlayer ? { type: 'player' as const, id: attacker.defendingPlayer } : undefined),
    })).filter((attacker): attacker is { attackerId: ObjectId; defender: AttackTarget } => Boolean(attacker.defender));

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

  private removeAttackersDefendingTarget(targetId: ObjectId): void {
    this.combatManager.removeAttackersDefendingTarget(this.state, targetId);
  }

  private chooseDefaultBattleProtector(controller: PlayerId): PlayerId | null {
    return this.state.turnOrder.find((candidate) =>
      candidate !== controller && !this.state.players[candidate].hasLost
    ) ?? null;
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

    // Calculate cost (including commander tax and alternative costs)
    const player = this.state.players[playerId];
    let castMethod = requestedCastMethod;

    const matchingAltCost = castMethod
      ? this.findAlternativeCast(card, castMethod)
      : undefined;

    if (!this.canCastThisWay(playerId, card, {
      spellDefinition: effectiveDef,
      castMethod,
      castAsAdventure,
      chosenFace,
      chosenHalf,
    })) {
      return;
    }

    let cost: ManaCost;
    if (matchingAltCost && matchingAltCost.cost.mana) {
      cost = { ...matchingAltCost.cost.mana };
    } else if (chosenHalf === 'fused' && card.definition.splitHalf) {
      // Fuse: pay both halves' costs combined
      const left = card.definition.manaCost;
      const right = card.definition.splitHalf.manaCost;
      cost = {
        generic: left.generic + right.generic,
        W: left.W + right.W, U: left.U + right.U, B: left.B + right.B,
        R: left.R + right.R, G: left.G + right.G, C: left.C + right.C,
        X: left.X + right.X,
      };
    } else if (castAsAdventure && card.definition.adventure) {
      cost = { ...card.definition.adventure.manaCost };
    } else {
      cost = { ...effectiveDef.manaCost };
    }

    const isCommanderCast = card.zone === 'COMMAND' && player.commanderIds.includes(card.cardId);
    if (isCommanderCast) {
      const tax = (player.commanderTimesCast[card.cardId] ?? 0) * 2;
      cost.generic += tax;
    }

    // --- X Spell handling ---
    let resolvedX = xValue;
    if (cost.X > 0) {
      if (resolvedX === undefined) {
        // Calculate the non-X base cost
        const baseCost = manaCostTotal({ ...cost, X: 0 });
        // Calculate max X: total available mana minus base cost
        const totalAvail = this.manaManager.totalAvailable(this.state, playerId);
        // Also consider untapped mana sources
        const battlefield = this.getBattlefield(undefined, playerId);
        let potentialMana = totalAvail;
        for (const c of battlefield) {
          if (c.tapped || c.controller !== playerId) continue;
          for (const ab of c.definition.abilities) {
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
      // Add X * (number of X symbols) to generic cost
      cost.generic += (resolvedX ?? 0) * cost.X;
      cost.X = 0; // X is now accounted for in generic
    }

    let additionalCostsPaid: string[] = [];
    if (card.definition.additionalCosts) {
      const additionalCostResult = await this.chooseAndPayAdditionalCosts(playerId, card, card.definition.additionalCosts);
      additionalCostsPaid = additionalCostResult.paidIds;
      cost = this.addManaCosts(cost, additionalCostResult.extraManaCost);
    }

    const altCostPayment: NonManaCostPaymentResult = matchingAltCost
      ? await this.payNonManaCostParts(playerId, card, matchingAltCost.cost)
      : { paid: true, returnedCards: [] };
    if (!altCostPayment.paid) {
      return;
    }

    if (!await this.applyTagBasedCastAdjustments(playerId, card, cost)) {
      return;
    }

    const spellAbility = effectiveDef.abilities.find(a => a.kind === 'modal') as ModalAbilityDef | undefined;
    let selectedModeChoices = requestedModeChoices ? [...requestedModeChoices] : undefined;
    let chosenTargetSpecs: import('./types').TargetSpec[] | undefined;
    if (spellAbility) {
      if (!selectedModeChoices) {
        const choices = this.createChoiceHelper(playerId);
        const modeLabels = spellAbility.modes.map((m, i) => ({ label: m.label, index: i }));
        const selected = await choices.chooseN(
          `Choose ${spellAbility.chooseCount} mode(s)`,
          modeLabels,
          spellAbility.chooseCount,
          (m) => m.label,
        );
        selectedModeChoices = selected.map(m => m.index);
      }
      chosenTargetSpecs = selectedModeChoices.flatMap((modeIndex) => spellAbility.modes[modeIndex]?.targets ?? []);
    } else if (castMethod === 'overload') {
      chosenTargetSpecs = [];
    }

    if (targets && targets.length > 0) {
      if (!this.areChosenTargetsLegal(playerId, card, effectiveDef, targets, chosenTargetSpecs)) {
        return;
      }
    } else if ((chosenTargetSpecs?.length ?? 0) > 0) {
      return;
    }

    if (card.definition.attachmentType === 'Aura') {
      const targetId = targets?.[0];
      if (typeof targetId === 'string' && !targetId.startsWith('player')) {
        card.attachedTo = targetId;
      }
    }

    // Auto-tap lands and pay mana
    const battlefield = this.getBattlefield(undefined, playerId);
    const landsToTap = this.manaManager.autoTapForCost(this.state, playerId, cost, battlefield);
    this.applyAutoTapPlan(playerId, landsToTap);

    if (!this.manaManager.payMana(this.state, playerId, cost)) return;

    if (targets && targets.length > 0) {
      const wardPaid = await this.payWardCostsIfNeeded(playerId, card, targets);
      if (!wardPaid) return;
    }

    // Track commander casts
    if (isCommanderCast) {
      player.commanderTimesCast[card.cardId] = (player.commanderTimesCast[card.cardId] ?? 0) + 1;
    }

    // Put spell on the stack
    const stackEntry = this.stackManager.castSpell(
      this.state,
      card,
      playerId,
      targets ?? [],
      resolvedX,
      effectiveDef,
    );

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
    if (matchingAltCost?.permanentResolution) {
      stackEntry.battlefieldEntry = {
        tapped: matchingAltCost.permanentResolution.tapped,
        attacking: matchingAltCost.permanentResolution.attacking === 'returned-attacker-target'
          ? altCostPayment.returnedAttackerDefender
          : undefined,
      };
    }

    // --- Modal spell handling ---
    if (spellAbility) {
      stackEntry.modeChoices = selectedModeChoices;
      stackEntry.ability = spellAbility;
      stackEntry.targetSpecs = chosenTargetSpecs;
    } else if (castMethod === 'overload') {
      stackEntry.targetSpecs = [];
    } else {
      const spellEffect = effectiveDef.abilities.find((ability) => ability.kind === 'spell');
      stackEntry.targetSpecs = spellEffect?.kind === 'spell'
        ? spellEffect.targets
        : (effectiveDef.attachmentType === 'Aura' && effectiveDef.attachTarget ? [effectiveDef.attachTarget] : undefined);
    }

    await this.applyCastKeywordEffects(playerId, card, effectiveDef, stackEntry);

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

    const ability = card.definition.abilities[abilityIndex];
    if (!ability || ability.kind !== 'activated') return;

    if (targets && targets.length > 0) {
      if (!this.areChosenTargetsLegal(playerId, card, ability, targets)) {
        return;
      }
      const wardPaid = await this.payWardCostsIfNeeded(playerId, card, targets);
      if (!wardPaid) return;
    }

    // Pay costs
    if (ability.cost.tap) {
      this.zoneManager.tapPermanent(this.state, sourceId);
    }
    if (ability.cost.mana) {
      if (!this.manaManager.payMana(this.state, playerId, ability.cost.mana)) return;
    }
    if (!(await this.payNonManaCostParts(playerId, card, {
      ...ability.cost,
      mana: undefined,
      tap: undefined,
    })).paid) return;

    // Planeswalker loyalty ability tracking: mark this planeswalker as having used an ability
    const isPlaneswalker = card.definition.types.includes(CardType.PLANESWALKER as CardTypeEnum);
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
    if (battlefield.some((card) => card.definition.tags?.includes('no-max-hand-size'))) {
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
    this.reassignBattleProtectors(playerId);

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

  private reassignBattleProtectors(removedPlayerId: PlayerId): void {
    for (const playerId of this.state.turnOrder) {
      for (const card of this.state.zones[playerId].BATTLEFIELD) {
        if (!card.definition.types.includes(CardType.BATTLE as CardTypeEnum)) continue;
        if (card.battleProtector !== removedPlayerId) continue;
        card.battleProtector = this.chooseDefaultBattleProtector(card.controller);
        if (!card.battleProtector) {
          this.removeAttackersDefendingTarget(card.objectId);
        }
      }
    }
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
      return findCard(this.state, t as string, entry.targetZoneChangeCounters?.[index] ?? undefined);
    }).filter(Boolean) as (CardInstance | PlayerId)[];

    const choices = this.createChoiceHelper(entry.controller);

    const ctx: EffectContext = {
      game: this,
      state: this.state,
      source: source!,
      controller: entry.controller,
      targets,
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

      chooseN: <T>(prompt: string, options: T[], n: number, labelFn?: (t: T) => string): Promise<T[]> => {
        return new Promise<T[]>((resolve) => {
          const req: ChoiceRequest = {
            type: 'chooseN',
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
              if (typeFilter && !typeFilter.some(t => card.definition.types.includes(t))) continue;
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
            addBattlefieldCards([CardType.CREATURE as CardTypeEnum, CardType.PLANESWALKER as CardTypeEnum, CardType.BATTLE as CardTypeEnum]);
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
  ): Promise<{ paidIds: string[]; extraManaCost: ManaCost }> {
    const helper = this.createChoiceHelper(playerId);
    const paidIds: string[] = [];
    let extraManaCost = emptyManaCost();

    for (const additionalCost of costs) {
      if (!additionalCost.optional) continue;
      const payIt = await helper.chooseYesNo(`Pay additional cost ${additionalCost.description}?`);
      if (!payIt) continue;
      if (!(await this.payNonManaCostParts(playerId, source, additionalCost.cost)).paid) continue;
      extraManaCost = this.addManaCosts(extraManaCost, additionalCost.cost.mana);
      paidIds.push(additionalCost.id);
    }

    return { paidIds, extraManaCost };
  }

  private async applyCastKeywordEffects(
    playerId: PlayerId,
    card: CardInstance,
    definition: CardDefinition,
    stackEntry: StackEntry,
  ): Promise<void> {
    const tags = definition.tags ?? [];

    if (tags.includes('storm')) {
      const stormCount = Math.max(0, (this.state.players[playerId].spellsCastThisTurn ?? 1) - 1);
      for (let i = 0; i < stormCount; i++) {
        this.copySpellOnStack(stackEntry.id, playerId);
      }
    }

    if (tags.includes('cascade')) {
      await this.handleCascade(playerId, definition);
    }
  }

  private async handleCascade(playerId: PlayerId, sourceDefinition: CardDefinition): Promise<void> {
    const library = this.state.zones[playerId].LIBRARY;
    const exiled: CardInstance[] = [];
    let found: CardInstance | null = null;
    const sourceManaValue = this.getManaValue(sourceDefinition.manaCost);

    while (library.length > 0) {
      const card = library[library.length - 1];
      this.zoneManager.moveCard(this.state, card.objectId, 'EXILE', playerId);
      exiled.push(card);

      if (card.definition.types.includes(CardType.LAND as CardTypeEnum)) {
        continue;
      }
      if (this.getManaValue(card.definition.manaCost) < sourceManaValue) {
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

  private getManaValue(cost: ManaCost): number {
    return (
      cost.generic +
      cost.W +
      cost.U +
      cost.B +
      cost.R +
      cost.G +
      cost.C +
      (cost.hybrid?.length ?? 0) +
      (cost.phyrexian?.length ?? 0)
    );
  }

  private async payNonManaCostParts(playerId: PlayerId, source: CardInstance, cost: import('./types').Cost): Promise<NonManaCostPaymentResult> {
    const result: NonManaCostPaymentResult = {
      paid: true,
      returnedCards: [],
    };

    if (cost.payLife) {
      this.loseLife(playerId, cost.payLife);
    }

    if (cost.exileFromGraveyard) {
      const graveyard = this.state.zones[playerId].GRAVEYARD.filter(card => card.objectId !== source.objectId);
      const helper = this.createChoiceHelper(playerId);
      if (typeof cost.exileFromGraveyard === 'number') {
        if (graveyard.length < cost.exileFromGraveyard) return { ...result, paid: false };
        const selected = await helper.chooseN(
          `Choose ${cost.exileFromGraveyard} card(s) to exile from your graveyard`,
          graveyard,
          cost.exileFromGraveyard,
          card => card.definition.name,
        );
        for (const card of selected) {
          this.zoneManager.moveCard(this.state, card.objectId, 'EXILE', playerId);
        }
      } else {
        const matching = graveyard.filter(card => this.matchesFilter(card, cost.exileFromGraveyard as CardFilter, playerId));
        if (matching.length === 0) return { ...result, paid: false };
        const selected = await helper.chooseOne(
          'Choose a card to exile from your graveyard',
          matching,
          card => card.definition.name,
        );
        this.zoneManager.moveCard(this.state, selected.objectId, 'EXILE', playerId);
      }
    }

    if (typeof cost.discard === 'number' && cost.discard > 0) {
      const hand = [...this.state.zones[playerId].HAND];
      if (hand.length < cost.discard) return { ...result, paid: false };
      const helper = this.createChoiceHelper(playerId);
      const selected = await helper.chooseN(
        `Choose ${cost.discard} card(s) to discard`,
        hand,
        cost.discard,
        card => card.definition.name,
      );
      for (const card of selected) {
        this.zoneManager.discardCard(this.state, playerId, card.objectId);
      }
    } else if (cost.discard) {
      const matching = this.state.zones[playerId].HAND.filter(card =>
        this.matchesFilter(card, cost.discard as CardFilter, playerId)
      );
      if (matching.length === 0) return { ...result, paid: false };
      const helper = this.createChoiceHelper(playerId);
      const selected = await helper.chooseOne(
        'Choose a card to discard',
        matching,
        card => card.definition.name,
      );
      this.zoneManager.discardCard(this.state, playerId, selected.objectId);
    }

    if (cost.returnToHand) {
      const helper = this.createChoiceHelper(playerId);
      const { candidates, defenderByObjectId } = this.getReturnToHandCandidates(playerId, cost.returnToHand);
      if (candidates.length < cost.returnToHand.count) {
        return { ...result, paid: false };
      }

      const selected = cost.returnToHand.count === 1
        ? [await helper.chooseOne('Choose a permanent to return to hand', candidates, card => card.definition.name)]
        : await helper.chooseN(
          `Choose ${cost.returnToHand.count} permanent(s) to return to hand`,
          candidates,
          cost.returnToHand.count,
          card => card.definition.name,
        );

      for (const card of selected) {
        if (!result.returnedAttackerDefender) {
          result.returnedAttackerDefender = defenderByObjectId.get(card.objectId);
        }
        this.returnToHand(card.objectId);
        result.returnedCards.push(card);
      }
    }

    if (cost.removeCounters) {
      const currentCount = source.counters[cost.removeCounters.type] ?? 0;
      if (currentCount < cost.removeCounters.count) return { ...result, paid: false };
      this.removeCounters(source.objectId, cost.removeCounters.type, cost.removeCounters.count);
    }

    if (cost.sacrifice) {
      if (cost.sacrifice.self) {
        this.sacrificePermanent(source.objectId, playerId);
      } else {
        const selected = await this.sacrificePermanents(
          playerId,
          cost.sacrifice as CardFilter,
          1,
          'Choose a permanent to sacrifice',
        );
        if (selected.length === 0) return { ...result, paid: false };
      }
    }

    if (cost.custom && !cost.custom(this.state, source, playerId)) {
      return { ...result, paid: false };
    }

    return result;
  }

  private getReturnToHandCandidates(
    playerId: PlayerId,
    requirement: NonNullable<Cost['returnToHand']>,
  ): {
    candidates: CardInstance[];
    defenderByObjectId: Map<ObjectId, AttackTarget>;
  } {
    const defenderByObjectId = new Map<ObjectId, AttackTarget>();

    if (requirement.mustBeUnblockedAttacker) {
      const candidates = this.combatManager.getUnblockedAttackers(this.state, playerId)
        .filter(({ attacker }) =>
          this.matchesReturnToHandController(attacker, playerId, requirement.controller) &&
          this.matchesFilter(attacker, requirement.filter, playerId)
        )
        .map(({ attacker, defender }) => {
          defenderByObjectId.set(attacker.objectId, defender);
          return attacker;
        });

      return { candidates, defenderByObjectId };
    }

    const candidates: CardInstance[] = [];
    for (const candidate of this.getBattlefield()) {
      if (
        this.matchesReturnToHandController(candidate, playerId, requirement.controller) &&
        this.matchesFilter(candidate, requirement.filter, playerId)
      ) {
        candidates.push(candidate);
      }
    }

    return { candidates, defenderByObjectId };
  }

  private matchesReturnToHandController(
    candidate: CardInstance,
    playerId: PlayerId,
    controller: NonNullable<Cost['returnToHand']>['controller'] = 'you',
  ): boolean {
    if (controller === 'you') return candidate.controller === playerId;
    if (controller === 'opponent') return candidate.controller !== playerId;
    return true;
  }

  private async applyTagBasedCastAdjustments(
    playerId: PlayerId,
    source: CardInstance,
    cost: ManaCost,
  ): Promise<boolean> {
    const tags = source.definition.tags ?? [];

    if (tags.includes('delve') && cost.generic > 0) {
      const graveyard = this.state.zones[playerId].GRAVEYARD.filter(card => card.objectId !== source.objectId);
      if (graveyard.length > 0) {
        const helper = this.createChoiceHelper(playerId);
        const selected = await helper.chooseUpToN(
          `Choose up to ${cost.generic} card(s) to exile for delve`,
          graveyard,
          Math.min(cost.generic, graveyard.length),
          card => card.definition.name,
        );
        for (const card of selected) {
          this.zoneManager.moveCard(this.state, card.objectId, 'EXILE', playerId);
        }
        cost.generic = Math.max(0, cost.generic - selected.length);
      }
    }

    if (tags.includes('convoke')) {
      const creatures = this.state.zones[playerId].BATTLEFIELD.filter(card =>
        !card.phasedOut &&
        !card.tapped &&
        card.definition.types.includes(CardType.CREATURE as CardTypeEnum),
      );
      const maxConvoke = Math.min(manaCostTotal(cost), creatures.length);
      if (maxConvoke > 0) {
        const helper = this.createChoiceHelper(playerId);
        const selected = await helper.chooseUpToN(
          `Choose up to ${maxConvoke} creature(s) to tap for convoke`,
          creatures,
          maxConvoke,
          card => card.definition.name,
        );
        for (const creature of selected) {
          this.zoneManager.tapPermanent(this.state, creature.objectId);
          const colors = creature.definition.colorIdentity;
          const payableColor = colors.find(color => cost[color] > 0);
          if (payableColor) {
            cost[payableColor] = Math.max(0, cost[payableColor] - 1);
          } else {
            cost.generic = Math.max(0, cost.generic - 1);
          }
        }
      }
    }

    return true;
  }

  private addManaCosts(base: ManaCost, extra?: ManaCost): ManaCost {
    if (!extra) return { ...base };
    return {
      generic: base.generic + extra.generic,
      W: base.W + extra.W,
      U: base.U + extra.U,
      B: base.B + extra.B,
      R: base.R + extra.R,
      G: base.G + extra.G,
      C: base.C + extra.C,
      X: base.X + extra.X,
      hybrid: [...(base.hybrid ?? []), ...(extra.hybrid ?? [])],
      phyrexian: [...(base.phyrexian ?? []), ...(extra.phyrexian ?? [])],
    };
  }

  private payAttackTaxesIfNeeded(
    playerId: PlayerId,
    declarations: Array<{ attackerId: ObjectId; defender: AttackTarget }>,
  ): boolean {
    const attackTaxCost = this.getAttackTaxCost(declarations);
    if (manaCostTotal(attackTaxCost) === 0 && (attackTaxCost.hybrid?.length ?? 0) === 0 && (attackTaxCost.phyrexian?.length ?? 0) === 0) {
      return true;
    }

    const battlefield = this.getBattlefield(undefined, playerId);
    const plan = this.manaManager.autoTapForCost(this.state, playerId, attackTaxCost, battlefield);
    if (!plan) {
      return false;
    }
    this.applyAutoTapPlan(playerId, plan);
    return true;
  }

  private getAttackTaxCost(
    declarations: Array<{ attackerId: ObjectId; defender: AttackTarget }>,
  ): ManaCost {
    let totalCost = emptyManaCost();

    for (const declaration of declarations) {
      const attacker = findCard(this.state, declaration.attackerId);
      if (!attacker) continue;

      for (const tax of attacker.attackTaxes ?? []) {
        if (declaration.defender.type !== 'player' || tax.defender !== declaration.defender.id) continue;
        totalCost = this.addManaCosts(totalCost, tax.cost.mana);
      }
    }

    return totalCost;
  }

  private async payWardCostsIfNeeded(
    playerId: PlayerId,
    source: CardInstance,
    targets: (ObjectId | PlayerId)[],
  ): Promise<boolean> {
    const seen = new Set<string>();
    for (const targetId of targets) {
      if (typeof targetId !== 'string' || targetId.startsWith('player')) continue;
      if (seen.has(targetId)) continue;
      seen.add(targetId);

      const target = findCard(this.state, targetId);
      if (!target || target.zone !== 'BATTLEFIELD' || target.phasedOut) continue;
      if (target.controller === playerId) continue;
      const wardCost = target.wardCost ?? target.definition.wardCost;
      if (!wardCost) continue;
      if (!await this.payAuxiliaryCost(playerId, source, wardCost, `Pay ward for ${target.definition.name}?`)) {
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
    if (!(await this.payNonManaCostParts(playerId, source, cost)).paid) return false;
    if (cost.mana && !await this.payExtraManaCost(playerId, cost.mana)) return false;
    return true;
  }

  private async payExtraManaCost(playerId: PlayerId, cost: ManaCost): Promise<boolean> {
    const battlefield = this.getBattlefield(undefined, playerId);
    const landsToTap = this.manaManager.autoTapForCost(this.state, playerId, cost, battlefield);
    this.applyAutoTapPlan(playerId, landsToTap);
    return this.manaManager.payMana(this.state, playerId, cost);
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
      this.manaManager.addMana(this.state, playerId, entry.color, entry.amount);
      if (entry.tap) {
        this.zoneManager.tapPermanent(this.state, entry.sourceId);
      }
      if (entry.sacrificeSelf) {
        this.sacrificePermanent(entry.sourceId, playerId);
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
        if (!this.canTargetObject(controller, source, candidate)) return false;
        return spec.custom ? spec.custom(candidate, game) : true;
      },
    });
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

    if (targets.length < targetSpecs.length) return false;
    for (let i = 0; i < targetSpecs.length; i++) {
      const target = targets[i];
      if (target === undefined) return false;
      const targetObj = typeof target === 'string' && target.startsWith('player')
        ? target as PlayerId
        : findCard(this.state, target as ObjectId);
      if (!targetObj) return false;
      if (!this.matchesTargetSpec(targetObj, targetSpecs[i], controller)) return false;
      if (!this.canTargetObject(controller, source, targetObj)) return false;
    }
    return true;
  }

  private getTargetSpecs(
    definitionOrAbility: CardDefinition | AbilityDefinition,
  ): import('./types').TargetSpec[] | undefined {
    if ('types' in definitionOrAbility) {
      const spellAbility = definitionOrAbility.abilities.find(ability => ability.kind === 'spell');
      const modalAbility = definitionOrAbility.abilities.find(ability => ability.kind === 'modal');
      if (spellAbility?.kind === 'spell' && spellAbility.targets) {
        return spellAbility.targets;
      }
      if (modalAbility?.kind === 'modal') {
        return modalAbility.modes[0]?.targets;
      }
      if (definitionOrAbility.attachmentType === 'Aura' && definitionOrAbility.attachTarget) {
        return [definitionOrAbility.attachTarget];
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
      creature: candidate.definition.types.includes(CardType.CREATURE),
      planeswalker: candidate.definition.types.includes(CardType.PLANESWALKER),
      permanent: candidate.zone === 'BATTLEFIELD',
      spell: candidate.zone === 'STACK',
      'card-in-graveyard': candidate.zone === (spec.zone ?? 'GRAVEYARD'),
      'creature-or-player': candidate.definition.types.includes(CardType.CREATURE),
      'creature-or-planeswalker': candidate.definition.types.includes(CardType.CREATURE) || candidate.definition.types.includes(CardType.PLANESWALKER),
      any: candidate.definition.types.includes(CardType.CREATURE)
        || candidate.definition.types.includes(CardType.PLANESWALKER)
        || candidate.definition.types.includes(CardType.BATTLE),
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
  ): boolean {
    if (typeof candidate === 'string') {
      return !this.state.players[candidate].hasLost;
    }

    if (candidate.zone === 'BATTLEFIELD' && candidate.phasedOut) return false;
    if (candidate.controller !== controller && candidate.cantBeTargetedByOpponents) return false;
    const keywords = candidate.modifiedKeywords ?? candidate.definition.keywords;
    if (keywords.includes(Keyword.SHROUD)) return false;
    if (candidate.controller !== controller && keywords.includes(Keyword.HEXPROOF)) return false;
    if (this.hasProtectionFrom(candidate, source)) return false;
    return true;
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
        manaCost: { ...card.definition.adventure.manaCost },
        types: [...card.definition.adventure.types],
        abilities: [{
          kind: 'spell',
          effect: card.definition.adventure.effect,
          description: card.definition.adventure.name,
        }],
        keywords: [],
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
    if (filter.types && !filter.types.some(t => card.definition.types.includes(t))) return false;
    if (filter.subtypes && !filter.subtypes.some(t => card.definition.subtypes.includes(t))) return false;
    if (filter.supertypes && !filter.supertypes.some(t => card.definition.supertypes.includes(t))) return false;
    if (filter.colors && !filter.colors.some(c => card.definition.colorIdentity.includes(c))) return false;
    if (filter.keywords && !filter.keywords.some(k => (card.modifiedKeywords ?? card.definition.keywords).includes(k))) return false;
    if (filter.controller === 'you' && sourceController && card.controller !== sourceController) return false;
    if (filter.controller === 'opponent' && sourceController && card.controller === sourceController) return false;
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.self === true && sourceController && card.controller !== sourceController) return false;
    if (filter.tapped === true && !card.tapped) return false;
    if (filter.tapped === false && card.tapped) return false;
    if (filter.isToken === true && !card.objectId.startsWith('token-')) return false;
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

  /** Check if `protectedCard` has protection from a quality that `source` possesses. */
  private hasProtectionFrom(protectedCard: CardInstance, source: CardInstance): boolean {
    const protections: ProtectionFrom[] = protectedCard.protectionFrom ?? protectedCard.definition.protectionFrom ?? [];
    if (protections.length === 0) return false;

    for (const prot of protections) {
      if (prot.colors && prot.colors.length > 0) {
        if (prot.colors.some(c => source.definition.colorIdentity.includes(c))) return true;
      }
      if (prot.types && prot.types.length > 0) {
        if (prot.types.some(t => source.definition.types.includes(t))) return true;
      }
      if (prot.custom && prot.custom(source)) return true;
    }

    return false;
  }

  private notifyStateChange(): void {
    for (const listener of this.stateChangeListeners) {
      listener(this.state);
    }
  }
}
