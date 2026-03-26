import type { GameState, PlayerId, GameEvent } from './types';
import { Phase, Step, GameEventType } from './types';
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
    state.activePlayer = newActive;
    state.turnNumber++;

    // Reset per-turn player state
    const player = state.players[newActive];
    player.hasPlayedLand = false;
    player.landsPlayedThisTurn = 0;
    player.landPlaysAvailable = 1;

    // Start at untap step
    this.transitionToStep(state, Phase.BEGINNING, Step.UNTAP);

    const event: GameEvent = {
      type: GameEventType.TURN_START,
      timestamp: getNextTimestamp(state),
      activePlayer: newActive,
      turnNumber: state.turnNumber,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);
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
        this.untapAll(state, activePlayer);
        // No priority during untap — immediately advance
        this.advanceStep(state);
        break;

      case Step.DRAW:
        // Active player draws (skip on turn 1 in multiplayer - first player doesn't draw)
        if (state.turnNumber > 1 || state.turnOrder.indexOf(activePlayer) !== 0) {
          this.zoneManager.drawCard(state, activePlayer);
        }
        // Priority will be given after
        break;

      case Step.CLEANUP:
        this.performCleanup(state, activePlayer);
        // Normally no priority during cleanup unless triggers fire
        if (state.pendingTriggers.length === 0) {
          this.advanceStep(state);
        }
        break;

      default:
        // Other steps: just give priority
        break;
    }
  }

  private untapAll(state: GameState, player: PlayerId): void {
    const battlefield = state.zones[player].BATTLEFIELD;
    for (const card of battlefield) {
      if (card.tapped) {
        card.tapped = false;
      }
      // Remove summoning sickness for creatures that survived a full turn
      card.summoningSick = false;
    }
  }

  private performCleanup(state: GameState, player: PlayerId): void {
    // Discard to hand size (7)
    const hand = state.zones[player].HAND;
    while (hand.length > 7) {
      // For now, auto-discard the last card. The UI will let the player choose.
      const card = hand[hand.length - 1];
      this.zoneManager.discardCard(state, player, card.objectId);
    }

    // Remove "until end of turn" effects
    state.continuousEffects = state.continuousEffects.filter(
      e => e.duration.type !== 'until-end-of-turn'
    );

    // Remove marked damage from all creatures
    for (const pid of state.turnOrder) {
      for (const card of state.zones[pid].BATTLEFIELD) {
        card.markedDamage = 0;
      }
    }

    // Clear combat state
    state.combat = null;
  }

  /** Check if current step allows sorcery-speed actions */
  canPlaySorcerySpeed(state: GameState, player: PlayerId): boolean {
    if (player !== state.activePlayer) return false;
    if (state.stack.length > 0) return false;
    return state.currentStep === Step.MAIN;
  }
}
