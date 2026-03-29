import { ManaColor } from './core';
import type { ObjectId, PlayerId } from './core';

export interface ManaCost {
  generic: number;
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
  X: number;
  hybrid?: string[];
  phyrexian?: ManaColor[];
}

export type ManaSpendRestriction =
  | { kind: 'powerstone' };

export interface ManaReductionBudget {
  generic?: number;
  W?: number;
  U?: number;
  B?: number;
  R?: number;
  G?: number;
  C?: number;
}

export function emptyManaCost(): ManaCost {
  return {
    generic: 0,
    W: 0,
    U: 0,
    B: 0,
    R: 0,
    G: 0,
    C: 0,
    X: 0,
    hybrid: [],
    phyrexian: [],
  };
}

export function parseManaCost(str: string): ManaCost {
  const cost = emptyManaCost();
  const tokens = str.match(/\{[^}]+\}/g) || [];
  for (const token of tokens) {
    const inner = token.slice(1, -1);
    if (inner === 'W') cost.W++;
    else if (inner === 'U') cost.U++;
    else if (inner === 'B') cost.B++;
    else if (inner === 'R') cost.R++;
    else if (inner === 'G') cost.G++;
    else if (inner === 'C') cost.C++;
    else if (inner === 'X') cost.X++;
    else if (inner.endsWith('/P')) {
      const color = inner[0] as ManaColor;
      if (color === 'W' || color === 'U' || color === 'B' || color === 'R' || color === 'G') {
        cost.phyrexian!.push(color);
      }
    } else if (inner.includes('/')) {
      cost.hybrid!.push(inner);
    } else {
      const n = parseInt(inner, 10);
      if (!Number.isNaN(n)) cost.generic += n;
    }
  }
  return cost;
}

export function manaCostTotal(cost: ManaCost): number {
  const hybridTotal = (cost.hybrid ?? []).reduce((total, symbol) => {
    if (symbol.startsWith('2/')) {
      return total + 2;
    }
    return total + 1;
  }, 0);
  return cost.generic + cost.W + cost.U + cost.B + cost.R + cost.G + cost.C + hybridTotal + (cost.phyrexian?.length ?? 0);
}

export function manaCostToString(cost: ManaCost): string {
  let s = '';
  for (let i = 0; i < cost.X; i++) s += '{X}';
  if (cost.generic > 0) s += `{${cost.generic}}`;
  for (let i = 0; i < cost.W; i++) s += '{W}';
  for (let i = 0; i < cost.U; i++) s += '{U}';
  for (let i = 0; i < cost.B; i++) s += '{B}';
  for (let i = 0; i < cost.R; i++) s += '{R}';
  for (let i = 0; i < cost.G; i++) s += '{G}';
  for (let i = 0; i < cost.C; i++) s += '{C}';
  for (const symbol of cost.hybrid ?? []) s += `{${symbol}}`;
  for (const color of cost.phyrexian ?? []) s += `{${color}/P}`;
  if (s === '') s = '{0}';
  return s;
}

export interface ManaPool {
  W: number;
  U: number;
  B: number;
  R: number;
  G: number;
  C: number;
}

export function emptyManaPool(): ManaPool {
  return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
}

export type ManaSymbol = keyof ManaPool;

export interface ManaProduction {
  amount: number;
  colors: ManaSymbol[];
  restrictToColorIdentity?: boolean;
  restriction?: ManaSpendRestriction;
}

export interface TrackedManaEffect {
  kind: 'etb-counter-on-non-human-creature';
  counterType: string;
  amount: number;
}

export interface TrackedMana {
  color: ManaSymbol;
  sourceId?: ObjectId;
  effect?: TrackedManaEffect;
  restriction?: ManaSpendRestriction;
}

export interface AddManaOptions {
  trackedMana?: Omit<TrackedMana, 'color'>;
}

export interface AddCounterOptions {
  player?: PlayerId;
  sourceId?: ObjectId;
  sourceCardId?: ObjectId;
  sourceZoneChangeCounter?: number;
}

export function manaCostColorIdentity(cost: ManaCost): ManaColor[] {
  const colors = new Set<ManaColor>();
  if (cost.W > 0) colors.add(ManaColor.WHITE);
  if (cost.U > 0) colors.add(ManaColor.BLUE);
  if (cost.B > 0) colors.add(ManaColor.BLACK);
  if (cost.R > 0) colors.add(ManaColor.RED);
  if (cost.G > 0) colors.add(ManaColor.GREEN);

  for (const symbol of cost.hybrid ?? []) {
    for (const part of symbol.split('/')) {
      if (part === 'W' || part === 'U' || part === 'B' || part === 'R' || part === 'G') {
        colors.add(part as ManaColor);
      }
    }
  }

  for (const color of cost.phyrexian ?? []) {
    colors.add(color);
  }

  return [...colors];
}
