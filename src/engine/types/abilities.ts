import type { CardInstance } from './cards';
import type { Phase, Step, Zone } from './core';
import type { Cost } from './costs';
import type { EffectFn, StaticEffectDef } from './effects';
import type { GameEvent } from './events';
import type { CardFilter, SpellFilter } from './filters';
import type { ManaProduction, TrackedManaEffect } from './mana';
import type { GameState } from './state';
import type { TargetSpec } from './targeting';

export type AbilityDefinition =
  | ActivatedAbilityDef
  | TriggeredAbilityDef
  | StaticAbilityDef;

export interface ActivatedAbilityDef {
  kind: 'activated';
  cost: Cost;
  effect: EffectFn;
  targets?: TargetSpec[];
  timing: 'instant' | 'sorcery';
  isManaAbility: boolean;
  activationZone?: Zone;
  activateOnlyDuringYourTurn?: boolean;
  manaProduction?: ManaProduction[];
  trackedManaEffect?: TrackedManaEffect;
  isExhaust?: boolean;
  description: string;
}

export interface TriggeredAbilityDef {
  kind: 'triggered';
  trigger: TriggerCondition;
  effect: EffectFn;
  manaProduction?: ManaProduction[];
  targets?: TargetSpec[];
  interveningIf?: (game: GameState, source: CardInstance, event: GameEvent) => boolean;
  isManaAbility?: boolean;
  oncePerTurn?: boolean;
  optional: boolean;
  description: string;
}

export interface StaticAbilityDef {
  kind: 'static';
  effect: StaticEffectDef;
  condition?: (game: GameState, source: CardInstance) => boolean;
  description: string;
}

export type TriggerCondition =
  | { on: 'enter-battlefield'; filter?: CardFilter }
  | { on: 'leave-battlefield'; filter?: CardFilter; destination?: Zone }
  | { on: 'cast-spell'; filter?: SpellFilter }
  | { on: 'dies'; filter?: CardFilter }
  | { on: 'attacks'; filter?: CardFilter }
  | { on: 'blocks'; filter?: CardFilter }
  | { on: 'deals-damage'; filter?: CardFilter; damageType?: 'combat' | 'noncombat' | 'any' }
  | { on: 'dealt-damage'; filter?: CardFilter }
  | { on: 'upkeep'; whose?: 'yours' | 'each' | 'opponents' }
  | { on: 'end-step'; whose?: 'yours' | 'each' }
  | { on: 'draw-card'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'tap'; filter?: CardFilter }
  | { on: 'tap-for-mana'; filter?: CardFilter }
  | { on: 'untap'; filter?: CardFilter }
  | { on: 'gain-life'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'lose-life'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'counter-placed'; counterType?: string; filter?: CardFilter; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'discard'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'landfall'; whose?: 'yours' | 'opponents' | 'any' }
  | { on: 'phase'; phase: Phase }
  | { on: 'step'; step: Step }
  | { on: 'custom'; match: (event: GameEvent, source: CardInstance, game: GameState) => boolean };
