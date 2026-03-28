import type { CardInstance } from './cards';
import type { CardType, ManaColor } from './core';
import type { GameState } from './state';

export interface CardFilter {
  types?: CardType[];
  subtypes?: string[];
  supertypes?: string[];
  colors?: ManaColor[];
  controller?: 'you' | 'opponent' | 'any';
  name?: string;
  self?: boolean;
  power?: { op: 'lte' | 'gte' | 'eq'; value: number };
  toughness?: { op: 'lte' | 'gte' | 'eq'; value: number };
  tapped?: boolean;
  isToken?: boolean;
  custom?: (card: CardInstance, game: GameState) => boolean;
}

export type SpellFilter = CardFilter;
