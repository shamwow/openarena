import type { GameState, PlayerId } from './types';

export class PriorityManager {
  /** Grant priority to the appropriate player */
  grantPriority(state: GameState): void {
    if (state.isGameOver) return;
    if (state.passedPriority.size === 0) {
      state.priorityPlayer = state.activePlayer;
    }
  }

  /** Handle a player passing priority */
  passPriority(state: GameState, playerId: PlayerId): 'resolve' | 'advance' | 'continue' {
    state.passedPriority.add(playerId);

    const activePlayers = this.getActivePlayers(state);

    if (state.passedPriority.size >= activePlayers.length) {
      state.passedPriority.clear();

      if (state.stack.length > 0) {
        // All passed with items on stack — resolve top
        state.priorityPlayer = state.activePlayer;
        return 'resolve';
      } else {
        // All passed with empty stack — advance to next step
        return 'advance';
      }
    }

    // Pass to next player in APNAP order
    state.priorityPlayer = this.getNextPlayerInAPNAP(state, playerId);
    return 'continue';
  }

  /** When a player takes an action, reset priority passing */
  playerTookAction(state: GameState, playerId: PlayerId): void {
    state.passedPriority.clear();
    state.priorityPlayer = playerId;
  }

  getActivePlayers(state: GameState): PlayerId[] {
    return state.turnOrder.filter(pid => !state.players[pid].hasLost);
  }

  /** Build APNAP order starting from active player */
  getAPNAPOrder(state: GameState): PlayerId[] {
    const active = this.getActivePlayers(state);
    const activeIdx = active.indexOf(state.activePlayer);
    if (activeIdx < 0) return active;

    return [
      ...active.slice(activeIdx),
      ...active.slice(0, activeIdx),
    ];
  }

  private getNextPlayerInAPNAP(state: GameState, currentPlayer: PlayerId): PlayerId {
    const apnap = this.getAPNAPOrder(state);
    const currentIdx = apnap.indexOf(currentPlayer);

    // Find next player who hasn't passed
    for (let i = 1; i < apnap.length; i++) {
      const nextIdx = (currentIdx + i) % apnap.length;
      const nextPlayer = apnap[nextIdx];
      if (!state.passedPriority.has(nextPlayer)) {
        return nextPlayer;
      }
    }

    // Shouldn't reach here
    return state.activePlayer;
  }
}
