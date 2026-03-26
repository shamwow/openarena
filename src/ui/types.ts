import type { CardInstance, PlayerAction, PlayerId, Zone } from '../engine/types';

export type SeatPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface SeatMeta {
  playerId: PlayerId;
  position: SeatPosition;
  isLocalSeat: boolean;
  handHidden: boolean;
}

export interface CardArtAsset {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  name: string;
  normal?: string;
  large?: string;
  png?: string;
  artCrop?: string;
  borderCrop?: string;
  fetchedAt?: number;
  cacheHit?: boolean;
  error?: string;
}

export interface PreviewCardState {
  card: CardInstance;
  ownerName: string;
  controllerName: string;
  seat: SeatPosition;
  hidden: boolean;
}

export interface RectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}

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
