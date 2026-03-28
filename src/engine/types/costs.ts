import type { CardInstance } from './cards';
import type { PlayerId } from './core';
import type { CardFilter } from './filters';
import type { ManaCost } from './mana';
import type { GameState } from './state';

export interface Cost {
  mana?: ManaCost;
  tap?: boolean;
  genericTapSubstitution?: GenericTapSubstitution;
  sacrifice?: CardFilter;
  discard?: CardFilter | number;
  payLife?: number;
  exileFromGraveyard?: CardFilter | number;
  removeCounters?: { type: string; count: number };
  custom?: (game: GameState, source: CardInstance, player: PlayerId) => boolean;
}

export interface GenericTapSubstitution {
  amount: number;
  filter: CardFilter;
  ignoreSummoningSickness?: boolean;
}
