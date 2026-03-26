import type {
  GameState, PlayerId, ObjectId, CardInstance, CardDefinition,
  CardFilter, ManaPool, ManaCost, Zone, EffectContext,
  StackEntry, GameEvent, PlayerAction,
  GameEngine as IGameEngine, Keyword, CardType as CardTypeEnum,
} from './types';
import {
  GameEventType, ActionType, CardType, Step,
  StackEntryType,
} from './types';
import { createInitialGameState, drawInitialHands, findCard, getNextTimestamp, type DeckConfig } from './GameState';
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

  constructor({
    decks,
    initialState,
    drawOpeningHands = initialState == null,
    runGameLoopOnInit = true,
  }: GameEngineInit = {}) {
    this.eventBus = new EventBus();
    this.zoneManager = new ZoneManager(this.eventBus);
    this.manaManager = new ManaManager(this.eventBus);
    this.turnManager = new TurnManager(this.eventBus, this.zoneManager, this.manaManager);
    this.priorityManager = new PriorityManager();
    this.stackManager = new StackManager(this.eventBus, this.zoneManager, this.manaManager);
    this.sbaChecker = new StateBasedActions(this.zoneManager, this.eventBus);
    this.combatManager = new CombatManager(this.eventBus, this.zoneManager);
    this.continuousEffects = new ContinuousEffectsEngine();

    const resolvedDecks = decks ?? [];
    this.state = initialState ?? createInitialGameState(resolvedDecks);

    if (initialState == null) {
      this.state.currentStep = Step.UPKEEP;
      this.state.priorityPlayer = this.state.activePlayer;
    }

    if (drawOpeningHands) {
      drawInitialHands(this.state);
    }

    // Listen to all events for the game log
    this.eventBus.onAny((event) => {
      for (const listener of this.gameLogListeners) {
        listener(event);
      }
    });

    if (runGameLoopOnInit) {
      this.runGameLoop();
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
        this.handlePassPriority(action.playerId);
        break;

      case ActionType.PLAY_LAND:
        this.handlePlayLand(action.playerId, action.cardId);
        break;

      case ActionType.CAST_SPELL:
        await this.handleCastSpell(action.playerId, action.cardId, action.targets, action.xValue);
        break;

      case ActionType.ACTIVATE_ABILITY:
        await this.handleActivateAbility(action.playerId, action.sourceId, action.abilityIndex, action.targets);
        break;

      case ActionType.DECLARE_ATTACKERS:
        this.combatManager.declareAttackers(this.state, action.attackers);
        this.priorityManager.playerTookAction(this.state, action.playerId);
        break;

      case ActionType.DECLARE_BLOCKERS:
        this.combatManager.declareBlockers(this.state, action.blockers);
        this.priorityManager.playerTookAction(this.state, action.playerId);
        break;

      case ActionType.CONCEDE:
        this.state.players[action.playerId].hasLost = true;
        this.state.players[action.playerId].hasConceded = true;
        this.checkGameOver();
        break;

      case ActionType.COMMANDER_TO_COMMAND_ZONE:
        this.handleCommanderToCommandZone(action.playerId, action.cardId);
        break;
    }

    this.runGameLoop();
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

      const isInstant = card.definition.types.includes(CardType.INSTANT);
      const hasFlash = card.definition.keywords.includes('Flash' as Keyword);

      if (isInstant || hasFlash || isSorcerySpeed) {
        if (this.manaManager.canAffordWithManaProduction(this.state, playerId, card.definition.manaCost)) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }
    }

    // Cast commander from command zone
    const commandZone = this.state.zones[playerId].COMMAND;
    for (const card of commandZone) {
      if (player.commanderIds.includes(card.objectId)) {
        const tax = (player.commanderTimesCast[card.objectId] ?? 0) * 2;
        const totalCost = { ...card.definition.manaCost, generic: card.definition.manaCost.generic + tax };
        if (this.manaManager.canAffordWithManaProduction(this.state, playerId, totalCost) && isSorcerySpeed) {
          actions.push({ type: ActionType.CAST_SPELL, playerId, cardId: card.objectId });
        }
      }
    }

    // Activate abilities on the battlefield
    const battlefield = this.state.zones[playerId].BATTLEFIELD;
    for (const card of battlefield) {
      for (let i = 0; i < card.definition.abilities.length; i++) {
        const ability = card.definition.abilities[i];
        if (ability.kind !== 'activated') continue;
        if (ability.timing === 'sorcery' && !isSorcerySpeed) continue;
        if (ability.cost.tap && card.tapped) continue;
        if (ability.cost.tap && card.summoningSick && !card.definition.keywords.includes('Haste' as Keyword)) continue;
        if (ability.cost.mana && !this.manaManager.canAffordWithManaProduction(this.state, playerId, ability.cost.mana)) continue;

        actions.push({
          type: ActionType.ACTIVATE_ABILITY,
          playerId,
          sourceId: card.objectId,
          abilityIndex: i,
        });
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
    if (typeof targetId === 'string' && targetId.startsWith('player')) {
      const player = this.state.players[targetId as PlayerId];
      if (!player || player.hasLost) return;
      player.life -= amount;

      const source = findCard(this.state, sourceId);
      const isCommander = source ? this.state.players[source.owner]?.commanderIds.includes(source.objectId) : false;
      if (isCommander && source) {
        player.commanderDamageReceived[source.objectId] =
          (player.commanderDamageReceived[source.objectId] ?? 0) + amount;
      }

      if (source && source.definition.keywords.includes('Lifelink' as Keyword)) {
        this.gainLife(source.controller, amount);
      }
    } else {
      const target = findCard(this.state, targetId as string);
      if (!target || target.zone !== 'BATTLEFIELD') return;
      target.markedDamage += amount;

      const source = findCard(this.state, sourceId);
      if (source && source.definition.keywords.includes('Lifelink' as Keyword)) {
        this.gainLife(source.controller, amount);
      }
    }

    const event: GameEvent = {
      type: GameEventType.DAMAGE_DEALT,
      timestamp: getNextTimestamp(this.state),
      sourceId,
      targetId,
      amount,
      isCombatDamage: isCombat,
      isCommanderDamage: false,
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
    const event: GameEvent = {
      type: GameEventType.SACRIFICED,
      timestamp: getNextTimestamp(this.state),
      objectId,
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
        if (!filter || this.matchesFilter(card, filter)) {
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

  // --- Private methods ---

  private handlePassPriority(playerId: PlayerId): void {
    const result = this.priorityManager.passPriority(this.state, playerId);

    if (result === 'resolve') {
      this.resolveTopOfStack();
    } else if (result === 'advance') {
      this.handleStepTransitionActions();
      this.turnManager.advanceStep(this.state);
    }
    // 'continue' — priority passed to next player, runGameLoop will auto-pass if needed
  }

  /** Perform step-specific actions when all players pass (before advancing) */
  private handleStepTransitionActions(): void {
    if (this.state.currentStep === Step.BEGINNING_OF_COMBAT) {
      this.combatManager.beginCombat(this.state);
    } else if (this.state.currentStep === Step.COMBAT_DAMAGE) {
      const needsFirstStrike = this.combatManager.needsFirstStrikeDamageStep(this.state);
      if (needsFirstStrike && !this.state.combat?.firstStrikeDamageDealt) {
        this.combatManager.dealCombatDamage(this.state, true);
      }
      this.combatManager.dealCombatDamage(this.state, false);
    } else if (this.state.currentStep === Step.END_OF_COMBAT) {
      this.combatManager.endCombat(this.state);
    }
  }

  private handlePlayLand(playerId: PlayerId, cardId: ObjectId): void {
    const card = findCard(this.state, cardId);
    if (!card) return;
    if (!this.turnManager.canPlaySorcerySpeed(this.state, playerId)) return;

    const player = this.state.players[playerId];
    if (player.landsPlayedThisTurn >= player.landPlaysAvailable) return;

    // Move land from hand to battlefield
    this.zoneManager.moveCard(this.state, cardId, 'BATTLEFIELD', playerId);
    player.landsPlayedThisTurn++;
    player.hasPlayedLand = true;
  }

  private async handleCastSpell(
    playerId: PlayerId,
    cardId: ObjectId,
    targets?: (ObjectId | PlayerId)[],
    xValue?: number
  ): Promise<void> {
    const card = findCard(this.state, cardId);
    if (!card) return;

    // Calculate cost (including commander tax)
    const cost = { ...card.definition.manaCost };
    const player = this.state.players[playerId];
    if (card.zone === 'COMMAND' && player.commanderIds.includes(cardId)) {
      const tax = (player.commanderTimesCast[cardId] ?? 0) * 2;
      cost.generic += tax;
    }

    // Auto-tap lands and pay mana
    const battlefield = this.getBattlefield(undefined, playerId);
    const landsToTap = this.manaManager.autoTapForCost(this.state, playerId, cost, battlefield);

    if (landsToTap) {
      for (const landId of landsToTap) {
        const land = findCard(this.state, landId);
        if (land) {
          // Execute mana abilities
          for (const ability of land.definition.abilities) {
            if (ability.kind === 'activated' && ability.isManaAbility) {
              const ctx = this.makeEffectContext({
                id: '',
                entryType: StackEntryType.ACTIVATED_ABILITY,
                sourceId: land.objectId,
                controller: playerId,
                timestamp: 0,
                targets: [],
                resolve: ability.effect,
              });
              ctx.source = land;
              await ability.effect(ctx);
              break;
            }
          }
          this.zoneManager.tapPermanent(this.state, landId);
        }
      }
    }

    if (!this.manaManager.payMana(this.state, playerId, cost)) return;

    // Track commander casts
    if (card.zone === 'COMMAND' && player.commanderIds.includes(cardId)) {
      player.commanderTimesCast[cardId] = (player.commanderTimesCast[cardId] ?? 0) + 1;
    }

    // Put spell on the stack
    this.stackManager.castSpell(
      this.state,
      card,
      playerId,
      targets ?? [],
      xValue
    );

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

    // Pay costs
    if (ability.cost.tap) {
      this.zoneManager.tapPermanent(this.state, sourceId);
    }
    if (ability.cost.mana) {
      if (!this.manaManager.payMana(this.state, playerId, ability.cost.mana)) return;
    }
    if (ability.cost.sacrifice?.self) {
      this.sacrificePermanent(sourceId, playerId);
    }
    if (ability.cost.payLife) {
      this.loseLife(playerId, ability.cost.payLife);
    }

    // Mana abilities resolve immediately
    if (ability.isManaAbility) {
      const ctx = this.makeEffectContext({
        id: '',
        entryType: StackEntryType.ACTIVATED_ABILITY,
        sourceId,
        controller: playerId,
        timestamp: 0,
        targets: targets ?? [],
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
    if (!this.state.players[playerId].commanderIds.includes(cardId)) return;
    this.zoneManager.moveCard(this.state, cardId, 'COMMAND', playerId);
  }

  private async resolveTopOfStack(): Promise<void> {
    const makeCtx = (entry: StackEntry) => this.makeEffectContext(entry);
    await this.stackManager.resolveTop(this.state, makeCtx);
  }

  private runGameLoop(): void {
    let iterations = 0;
    const maxIterations = 500; // safety valve (higher because auto-pass loops more)

    while (iterations < maxIterations) {
      iterations++;

      // 1. Check state-based actions
      if (this.sbaChecker.checkAndApply(this.state)) continue;

      // 2. Put triggered abilities on the stack
      if (this.placePendingTriggers()) continue;

      // 3. Recalculate continuous effects
      this.continuousEffects.applyAll(this.state);

      // 4. Check game over
      if (this.checkGameOver()) break;

      // 5. Grant priority
      this.priorityManager.grantPriority(this.state);

      // 6. Auto-pass: if current priority holder has no meaningful actions,
      //    automatically pass priority for them (Arena-style)
      const priorityHolder = this.state.priorityPlayer;
      if (priorityHolder && !this.hasMeaningfulActions(priorityHolder)) {
        // Auto-pass for this player
        const result = this.priorityManager.passPriority(this.state, priorityHolder);

        if (result === 'resolve') {
          // All players passed with stack items — resolve top
          this.resolveTopOfStack();
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

  private placePendingTriggers(): boolean {
    if (this.state.pendingTriggers.length === 0) return false;

    // Place triggers in APNAP order
    const apnap = this.priorityManager.getAPNAPOrder(this.state);
    const ordered = [...this.state.pendingTriggers].sort((a, b) => {
      const aIdx = apnap.indexOf(a.controller);
      const bIdx = apnap.indexOf(b.controller);
      return aIdx - bIdx;
    });

    for (const trigger of ordered) {
      this.stackManager.putTriggeredAbility(
        this.state,
        trigger.source,
        trigger.ability,
        trigger.controller,
        trigger.event
      );
    }

    this.state.pendingTriggers = [];
    return true;
  }

  private checkGameOver(): boolean {
    const alive = this.state.turnOrder.filter(pid => !this.state.players[pid].hasLost);
    if (alive.length <= 1) {
      this.state.isGameOver = true;
      this.state.winner = alive[0] ?? null;
      return true;
    }
    return false;
  }

  private makeEffectContext(entry: StackEntry): EffectContext {
    const source = entry.cardInstance ?? findCard(this.state, entry.sourceId);
    const targets = entry.targets.map(t => {
      if (typeof t === 'string' && t.startsWith('player')) return t as PlayerId;
      return findCard(this.state, t as string);
    }).filter(Boolean) as (CardInstance | PlayerId)[];

    return {
      game: this,
      state: this.state,
      source: source!,
      controller: entry.controller,
      targets,
      xValue: entry.xValue,
      choices: this.createChoiceHelper(entry.controller),
    };
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
        return new Promise((resolve) => {
          const candidates: (CardInstance | PlayerId)[] = [];
          if (spec.what === 'creature' || spec.what === 'permanent') {
            candidates.push(...this.getBattlefield(spec.filter));
          }
          if (spec.what === 'player' || spec.what === 'creature-or-player') {
            candidates.push(...this.getActivePlayers());
          }

          const req: ChoiceRequest = {
            type: 'chooseN',
            prompt: `[${this.state.players[controller].name}] Choose ${spec.count} target(s)`,
            options: candidates as unknown[],
            count: spec.count,
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

  private matchesFilter(card: CardInstance, filter: CardFilter): boolean {
    if (filter.types && !filter.types.some(t => card.definition.types.includes(t))) return false;
    if (filter.subtypes && !filter.subtypes.some(t => card.definition.subtypes.includes(t))) return false;
    if (filter.controller === 'you') return false; // Can't determine without source context
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.custom && !filter.custom(card, this.state)) return false;
    return true;
  }

  private notifyStateChange(): void {
    for (const listener of this.stateChangeListeners) {
      listener(this.state);
    }
  }
}
