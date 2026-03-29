import type { CardInstance } from './cards';
import type { PlayerId } from './core';
import type { CardFilter } from './filters';
import type { ManaCost } from './mana';
import type { GameState } from './state';

export interface PlainCost {
  mana?: ManaCost;
  convoke?: boolean;
  delve?: boolean;
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
  keywordAction?: string;
}

/** @deprecated Use PlainCost for data declarations or Cost class for runtime. */
export type Cost = PlainCost;
