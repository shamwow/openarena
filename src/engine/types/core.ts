export type PlayerId = 'player1' | 'player2' | 'player3' | 'player4';
export type ObjectId = string;
export type Timestamp = number;

export const Phase = {
  BEGINNING: 'BEGINNING',
  PRECOMBAT_MAIN: 'PRECOMBAT_MAIN',
  COMBAT: 'COMBAT',
  POSTCOMBAT_MAIN: 'POSTCOMBAT_MAIN',
  ENDING: 'ENDING',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];

export const Step = {
  UNTAP: 'UNTAP',
  UPKEEP: 'UPKEEP',
  DRAW: 'DRAW',
  MAIN: 'MAIN',
  BEGINNING_OF_COMBAT: 'BEGINNING_OF_COMBAT',
  DECLARE_ATTACKERS: 'DECLARE_ATTACKERS',
  DECLARE_BLOCKERS: 'DECLARE_BLOCKERS',
  FIRST_STRIKE_DAMAGE: 'FIRST_STRIKE_DAMAGE',
  COMBAT_DAMAGE: 'COMBAT_DAMAGE',
  END_OF_COMBAT: 'END_OF_COMBAT',
  END: 'END',
  CLEANUP: 'CLEANUP',
} as const;
export type Step = (typeof Step)[keyof typeof Step];

export const Zone = {
  LIBRARY: 'LIBRARY',
  HAND: 'HAND',
  BATTLEFIELD: 'BATTLEFIELD',
  GRAVEYARD: 'GRAVEYARD',
  EXILE: 'EXILE',
  STACK: 'STACK',
  COMMAND: 'COMMAND',
} as const;
export type Zone = (typeof Zone)[keyof typeof Zone];

export const ManaColor = {
  WHITE: 'W',
  BLUE: 'U',
  BLACK: 'B',
  RED: 'R',
  GREEN: 'G',
  COLORLESS: 'C',
} as const;
export type ManaColor = (typeof ManaColor)[keyof typeof ManaColor];

export const CardType = {
  CREATURE: 'Creature',
  INSTANT: 'Instant',
  SORCERY: 'Sorcery',
  ENCHANTMENT: 'Enchantment',
  ARTIFACT: 'Artifact',
  PLANESWALKER: 'Planeswalker',
  LAND: 'Land',
  BATTLE: 'Battle',
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];
