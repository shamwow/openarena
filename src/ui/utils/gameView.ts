import type { CardInstance, GameState, PlayerAction } from '../../engine/types';
import { ActionType, Zone } from '../../engine/types';
import type { CardLocationSnapshot, SeatMeta } from '../types';

export const BOARD_SEATS: SeatMeta[] = [
  { playerId: 'player3', position: 'top-left', isLocalSeat: false, handHidden: true },
  { playerId: 'player4', position: 'top-right', isLocalSeat: false, handHidden: true },
  { playerId: 'player2', position: 'bottom-left', isLocalSeat: false, handHidden: true },
  { playerId: 'player1', position: 'bottom-right', isLocalSeat: true, handHidden: false },
];

export function isTokenCard(card: CardInstance): boolean {
  return card.definition.id.startsWith('token-');
}

export function getCardActions(card: CardInstance, legalActions: PlayerAction[]): PlayerAction[] {
  return legalActions.filter((action) => {
    if ('cardId' in action && action.cardId === card.objectId) {
      return true;
    }
    if ('sourceId' in action && action.sourceId === card.objectId) {
      return true;
    }
    return false;
  });
}

export function getPrimaryCardAction(card: CardInstance, legalActions: PlayerAction[]): PlayerAction | null {
  const cardActions = getCardActions(card, legalActions);
  if (cardActions.length === 0) {
    return null;
  }

  const preferred = cardActions.find(
    (action) =>
      action.type !== ActionType.PASS_PRIORITY && action.type !== ActionType.CONCEDE,
  );

  return preferred ?? cardActions[0];
}

export function findCardName(state: GameState, objectId: string): string {
  const card = findCardInstance(state, objectId);
  return card?.definition.name ?? 'Unknown Card';
}

export function findCardInstance(state: GameState, objectId: string): CardInstance | null {
  for (const playerId of state.turnOrder) {
    const playerZones = state.zones[playerId];
    for (const zoneCards of Object.values(playerZones)) {
      const match = zoneCards.find((card) => card.objectId === objectId);
      if (match) {
        return match;
      }
    }
  }

  for (const entry of state.stack) {
    if (entry.cardInstance?.objectId === objectId) {
      return entry.cardInstance;
    }
  }

  return null;
}

export function snapshotCardLocations(state: GameState): Record<string, CardLocationSnapshot> {
  const snapshot: Record<string, CardLocationSnapshot> = {};

  for (const playerId of state.turnOrder) {
    const playerZones = state.zones[playerId];
    for (const zone of Object.values(Zone)) {
      for (const card of playerZones[zone]) {
        snapshot[card.objectId] = { playerId, zone };
      }
    }
  }

  for (const entry of state.stack) {
    if (entry.cardInstance) {
      snapshot[entry.cardInstance.objectId] = {
        playerId: entry.cardInstance.controller,
        zone: 'STACK',
      };
    }
  }

  return snapshot;
}
