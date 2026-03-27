import type { GameState, PlayerId, GameEvent, CardInstance } from './types';
import { Phase, Step, GameEventType, Keyword } from './types';
import { getNextTimestamp } from './GameState';
import type { EventBus } from './EventBus';
import type { ZoneManager } from './ZoneManager';
import type { ManaManager } from './ManaManager';

export interface PhaseStep {
  phase: Phase;
  step: Step;
}

export const TURN_STRUCTURE: PhaseStep[] = [
  { phase: Phase.BEGINNING, step: Step.UNTAP },
  { phase: Phase.BEGINNING, step: Step.UPKEEP },
  { phase: Phase.BEGINNING, step: Step.DRAW },
  { phase: Phase.PRECOMBAT_MAIN, step: Step.MAIN },
  { phase: Phase.COMBAT, step: Step.BEGINNING_OF_COMBAT },
  { phase: Phase.COMBAT, step: Step.DECLARE_ATTACKERS },
  { phase: Phase.COMBAT, step: Step.DECLARE_BLOCKERS },
  { phase: Phase.COMBAT, step: Step.COMBAT_DAMAGE },
  { phase: Phase.COMBAT, step: Step.END_OF_COMBAT },
  { phase: Phase.POSTCOMBAT_MAIN, step: Step.MAIN },
  { phase: Phase.ENDING, step: Step.END },
  { phase: Phase.ENDING, step: Step.CLEANUP },
];

export class TurnManager {
  private eventBus: EventBus;
  private zoneManager: ZoneManager;
  private manaManager: ManaManager;

  constructor(eventBus: EventBus, zoneManager: ZoneManager, manaManager: ManaManager) {
    this.eventBus = eventBus;
    this.zoneManager = zoneManager;
    this.manaManager = manaManager;
  }

  getCurrentIndex(state: GameState): number {
    return TURN_STRUCTURE.findIndex(
      ps => ps.phase === state.currentPhase && ps.step === state.currentStep
    );
  }

  advanceStep(state: GameState): void {
    if (state.currentStep === Step.DECLARE_BLOCKERS) {
      const nextCombatStep = this.needsFirstStrikeDamageStep(state)
        ? Step.FIRST_STRIKE_DAMAGE
        : Step.COMBAT_DAMAGE;
      this.transitionToStep(state, Phase.COMBAT, nextCombatStep);
      return;
    }

    if (state.currentStep === Step.FIRST_STRIKE_DAMAGE) {
      this.transitionToStep(state, Phase.COMBAT, Step.COMBAT_DAMAGE);
      return;
    }

    const currentIndex = this.getCurrentIndex(state);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= TURN_STRUCTURE.length) {
      this.advanceToNextTurn(state);
      return;
    }

    // Skip first-strike damage step if not needed (it's not in the default structure)
    // The combat manager will insert it dynamically if needed

    const next = TURN_STRUCTURE[nextIndex];
    this.transitionToStep(state, next.phase, next.step);
  }

  advanceToNextTurn(state: GameState): void {
    const pendingExtraTurns = state.pendingExtraTurns ?? [];
    while (pendingExtraTurns.length > 0) {
      const nextExtraTurnPlayer = pendingExtraTurns.shift()!;
      if (state.players[nextExtraTurnPlayer] && !state.players[nextExtraTurnPlayer].hasLost) {
        this.startTurn(state, nextExtraTurnPlayer);
        return;
      }
    }

    // Find next alive player
    const currentIdx = state.turnOrder.indexOf(state.activePlayer);
    let nextIdx = (currentIdx + 1) % state.turnOrder.length;
    let attempts = 0;
    while (state.players[state.turnOrder[nextIdx]].hasLost && attempts < 4) {
      nextIdx = (nextIdx + 1) % state.turnOrder.length;
      attempts++;
    }

    if (attempts >= 4) {
      state.isGameOver = true;
      return;
    }

    const newActive = state.turnOrder[nextIdx];
    this.startTurn(state, newActive);
  }

  private transitionToStep(state: GameState, phase: Phase, step: Step): void {
    // Empty mana pools on phase change
    if (phase !== state.currentPhase) {
      this.manaManager.emptyAllPools(state);
    }

    state.currentPhase = phase;
    state.currentStep = step;

    // Reset priority
    state.passedPriority.clear();
    state.priorityPlayer = null;

    const event: GameEvent = {
      type: GameEventType.STEP_CHANGE,
      timestamp: getNextTimestamp(state),
      phase,
      step,
      activePlayer: state.activePlayer,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    // Check triggers for step change
    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    // Perform turn-based actions
    this.performTurnBasedActions(state, step);
  }

  private performTurnBasedActions(state: GameState, step: Step): void {
    const activePlayer = state.activePlayer;

    switch (step) {
      case Step.UNTAP:
        // Phasing: phase in/out before untapping
        this.handlePhasing(state, activePlayer);
        // Day/Night transition check
        this.checkDayNightTransition(state);
        this.untapAll(state, activePlayer);
        // No priority during untap — immediately advance
        this.advanceStep(state);
        break;

      case Step.UPKEEP:
        // Suspend: remove time counters from exiled cards with time counters
        this.handleSuspendUpkeep(state, activePlayer);
        // Priority will be given after
        break;

      case Step.DRAW:
        // Active player draws (skip on turn 1 in multiplayer - first player doesn't draw)
        if (state.turnNumber > 1 || state.turnOrder.indexOf(activePlayer) !== 0) {
          this.zoneManager.drawCard(state, activePlayer);
        }
        // Priority will be given after
        break;

      case Step.MAIN:
        if (state.currentPhase === Phase.PRECOMBAT_MAIN) {
          this.handlePrecombatMainSagas(state, activePlayer);
        }
        break;

      case Step.END:
        // Monarch draws an extra card at end step
        this.handleMonarchDraw(state);
        break;

      case Step.CLEANUP:
        // Track spells cast last turn before resetting
        this.trackSpellsCastLastTurn(state);
        break;

      default:
        // Other steps: just give priority
        break;
    }
  }

  private untapAll(state: GameState, player: PlayerId): void {
    const battlefield = state.zones[player].BATTLEFIELD;
    for (const card of battlefield) {
      if (card.phasedOut) continue;
      if (card.tapped) {
        card.tapped = false;
      }
      // Remove summoning sickness for creatures that survived a full turn
      card.summoningSick = false;
    }
  }

  private performCleanup(state: GameState, player: PlayerId, discardToHandSize = true): void {
    if (discardToHandSize) {
      const hand = state.zones[player].HAND;
      while (hand.length > 7) {
        const card = hand[hand.length - 1];
        this.zoneManager.discardCard(state, player, card.objectId);
      }
    }

    // Remove "until end of turn" effects
    state.continuousEffects = state.continuousEffects.filter(
      e => e.duration.type !== 'until-end-of-turn'
    );

    // Remove marked damage from all creatures
    for (const pid of state.turnOrder) {
      for (const card of state.zones[pid].BATTLEFIELD) {
        card.markedDamage = 0;
        delete card.counters['deathtouch-damage'];
      }
    }

    // Clear combat state
    state.combat = null;
  }

  forceCleanup(state: GameState, discardToHandSize = true): void {
    this.performCleanup(state, state.activePlayer, discardToHandSize);
  }

  /** Phasing: phase out permanents with Phasing keyword, phase in previously phased-out permanents */
  private handlePhasing(state: GameState, player: PlayerId): void {
    const battlefield = state.zones[player].BATTLEFIELD;

    // Phase in: all phased-out permanents controlled by active player phase in
    for (const card of battlefield) {
      if (card.phasedOut) {
        card.phasedOut = false;
      }
    }

    // Phase out: all permanents with the Phasing keyword phase out
    for (const card of battlefield) {
      const keywords = card.modifiedKeywords ?? card.definition.keywords;
      if (keywords.includes(Keyword.PHASING)) {
        card.phasedOut = true;
      }
    }
  }

  /** Day/Night transition check at beginning of each turn */
  private checkDayNightTransition(state: GameState): void {
    if (state.dayNight === undefined) return; // Day/Night not active yet

    const previousActivePlayer = state.lastCompletedTurnPlayer;
    if (!previousActivePlayer) return;
    const lastTurnSpells = state.spellsCastLastTurn?.[previousActivePlayer] ?? 0;

    if (state.dayNight === 'day') {
      // Transitions to night if the previous turn's active player cast no spells
      if (lastTurnSpells === 0) {
        state.dayNight = 'night';
      }
    } else if (state.dayNight === 'night') {
      // Transitions to day if the previous turn's active player cast 2+ spells
      if (lastTurnSpells >= 2) {
        state.dayNight = 'day';
      }
    }
  }

  /** Track spells cast this turn into spellsCastLastTurn before cleanup */
  private trackSpellsCastLastTurn(state: GameState): void {
    if (!state.spellsCastLastTurn) {
      state.spellsCastLastTurn = {} as Record<PlayerId, number>;
    }
    for (const pid of state.turnOrder) {
      state.spellsCastLastTurn[pid as PlayerId] = state.players[pid].spellsCastThisTurn ?? 0;
    }
    state.lastCompletedTurnPlayer = state.activePlayer;
  }

  /** Suspend: during upkeep, remove time counters from exiled cards with time counters */
  private handleSuspendUpkeep(state: GameState, activePlayer: PlayerId): void {
    const exile = state.zones[activePlayer].EXILE;
    const toRemoveTimeCounter: CardInstance[] = [];

    for (const card of exile) {
      if (card.owner === activePlayer && (card.counters['time'] ?? 0) > 0) {
        toRemoveTimeCounter.push(card);
      }
    }

    for (const card of toRemoveTimeCounter) {
      card.counters['time'] = (card.counters['time'] ?? 0) - 1;
      if (card.counters['time'] <= 0) {
        delete card.counters['time'];
        if (!state.pendingFreeCasts) {
          state.pendingFreeCasts = [];
        }
        state.pendingFreeCasts.push({
          objectId: card.objectId,
          playerId: activePlayer,
          reason: 'suspend',
        });
      }
    }
  }

  /** Add a lore counter to each Saga the active player controls at the start of precombat main. */
  private handlePrecombatMainSagas(state: GameState, activePlayer: PlayerId): void {
    for (const card of state.zones[activePlayer].BATTLEFIELD) {
      if (card.phasedOut) continue;
      if (!card.definition.sagaChapters || card.definition.sagaChapters.length === 0) continue;
      card.counters.lore = (card.counters.lore ?? 0) + 1;
      const event: GameEvent = {
        type: GameEventType.COUNTER_ADDED,
        timestamp: getNextTimestamp(state),
        objectId: card.objectId,
        counterType: 'lore',
        amount: 1,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);
      const triggers = this.eventBus.checkTriggers(event, state);
      for (const t of triggers) {
        state.pendingTriggers.push(t);
      }
    }
  }

  /** Monarch draws an extra card at the end step */
  private handleMonarchDraw(state: GameState): void {
    if (state.monarch && !state.players[state.monarch].hasLost) {
      this.zoneManager.drawCard(state, state.monarch);
    }
  }

  private startTurn(state: GameState, playerId: PlayerId): void {
    state.activePlayer = playerId;
    state.turnNumber++;
    this.clearExpiredGoad(state, playerId);

    const player = state.players[playerId];
    player.hasPlayedLand = false;
    player.landsPlayedThisTurn = 0;
    player.landPlaysAvailable = 1;

    for (const pid of state.turnOrder) {
      state.players[pid].spellsCastThisTurn = 0;
    }

    state.loyaltyAbilitiesUsedThisTurn = [];
    this.transitionToStep(state, Phase.BEGINNING, Step.UNTAP);

    const event: GameEvent = {
      type: GameEventType.TURN_START,
      timestamp: getNextTimestamp(state),
      activePlayer: playerId,
      turnNumber: state.turnNumber,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  /** Check if current step allows sorcery-speed actions */
  canPlaySorcerySpeed(state: GameState, player: PlayerId): boolean {
    if (player !== state.activePlayer) return false;
    if (state.stack.length > 0) return false;
    return state.currentStep === Step.MAIN;
  }

  private needsFirstStrikeDamageStep(state: GameState): boolean {
    if (!state.combat) return false;

    for (const [attackerId] of state.combat.attackers) {
      const attacker = this.findCombatCard(state, attackerId);
      if (attacker && this.hasFirstStrikeCapability(attacker)) {
        return true;
      }
    }

    for (const [blockerId] of state.combat.blockers) {
      const blocker = this.findCombatCard(state, blockerId);
      if (blocker && this.hasFirstStrikeCapability(blocker)) {
        return true;
      }
    }

    return false;
  }

  private hasFirstStrikeCapability(card: CardInstance): boolean {
    const keywords = card.modifiedKeywords ?? card.definition.keywords;
    return keywords.includes(Keyword.FIRST_STRIKE) || keywords.includes(Keyword.DOUBLE_STRIKE);
  }

  private findCombatCard(state: GameState, objectId: string): CardInstance | undefined {
    for (const playerId of state.turnOrder) {
      const card = state.zones[playerId].BATTLEFIELD.find((candidate) => candidate.objectId === objectId);
      if (card) {
        return card;
      }
    }

    return undefined;
  }

  private clearExpiredGoad(state: GameState, playerId: PlayerId): void {
    const counterName = `goaded-by-${playerId}`;

    for (const pid of state.turnOrder) {
      for (const card of state.zones[pid].BATTLEFIELD) {
        if (card.counters[counterName] !== undefined) {
          delete card.counters[counterName];
        }
      }
    }
  }
}
