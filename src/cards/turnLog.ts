import { GameEventType, type GameEvent, type GameState } from '../engine/types';

export function eventsThisTurn(state: GameState): GameEvent[] {
  const events: GameEvent[] = [];

  for (let index = state.eventLog.length - 1; index >= 0; index -= 1) {
    const event = state.eventLog[index];
    if (event.type === GameEventType.TURN_START) {
      break;
    }
    events.push(event);
  }

  return events;
}

export function someEventThisTurn(
  state: GameState,
  predicate: (event: GameEvent) => boolean,
): boolean {
  return eventsThisTurn(state).some(predicate);
}

export function countEventsThisTurn(
  state: GameState,
  predicate: (event: GameEvent) => boolean,
): number {
  return eventsThisTurn(state).filter(predicate).length;
}
