import type { CardInstance } from '../../engine/types';
import type { SeatPosition } from './layout';

export interface PreviewCardState {
  card: CardInstance;
  ownerName: string;
  controllerName: string;
  seat: SeatPosition;
  cursorX?: number;
}
