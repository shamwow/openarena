import type { CardInstance, PlayerAction, PlayerId, Zone } from '../../engine/types';
import type { RectSnapshot } from './layout';

export interface DragCardPayload {
  card: CardInstance;
  action: PlayerAction;
  playerId: PlayerId;
  sourceZone: Zone;
  hiddenSource: boolean;
}

export interface BattlefieldEntryAnimation {
  key: string;
  card: CardInstance;
  playerId: PlayerId;
  sourceZone: Zone | 'STACK' | 'UNKNOWN';
  hiddenSource: boolean;
  startRect: RectSnapshot;
  endRect: RectSnapshot;
}

export interface CardLocationSnapshot {
  playerId: PlayerId;
  zone: Zone | 'STACK';
}
