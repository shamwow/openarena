import type { CardInstance } from './cards';
import type { PlayerId, Zone } from './core';
import type { CardFilter } from './filters';
import type { GameState } from './state';

export interface TargetSpec {
  what: 'creature' | 'player' | 'permanent' | 'spell' | 'card-in-graveyard'
    | 'creature-or-player' | 'creature-or-planeswalker' | 'planeswalker' | 'any';
  filter?: CardFilter;
  zone?: Zone;
  count: number;
  upTo?: boolean;
  controller?: 'you' | 'opponent' | 'any';
  custom?: (candidate: CardInstance | PlayerId, game: GameState) => boolean;
}
