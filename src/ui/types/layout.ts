import type { PlayerId } from '../../engine/types';

export type SeatPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface SeatMeta {
  playerId: PlayerId;
  position: SeatPosition;
  isLocalSeat: boolean;
  handHidden: boolean;
}

export interface RectSnapshot {
  left: number;
  top: number;
  width: number;
  height: number;
}
