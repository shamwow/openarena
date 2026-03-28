import type { AbilityDefinition } from './abilities';
import type { CardInstance } from './cards';
import type { CardType, ManaColor, Zone } from './core';
import type { Cost, GenericTapSubstitution } from './costs';
import type { EffectFn } from './effects';
import type { CardFilter } from './filters';
import type { ManaCost } from './mana';
import type { TargetSpec } from './targeting';

export interface ProtectionFrom {
  colors?: ManaColor[];
  types?: CardType[];
  custom?: (source: CardInstance) => boolean;
}

export interface SpellModeDef {
  label: string;
  effect: EffectFn;
  targets?: TargetSpec[];
}

export interface SimpleSpellDef {
  kind: 'simple';
  effect: EffectFn;
  targets?: TargetSpec[];
  description: string;
}

export interface ModalSpellDef {
  kind: 'modal';
  modes: SpellModeDef[];
  chooseCount: number;
  allowRepeatedModes?: boolean;
  description: string;
}

export type SpellDefinition = SimpleSpellDef | ModalSpellDef;

export type AttachmentDefinition =
  | { type: 'Equipment' }
  | { type: 'Aura'; target: TargetSpec };

export interface SuspendDefinition {
  cost: Cost;
  timeCounters: number;
}

export interface CommanderOptions {
  partner?: boolean;
  friendsForever?: boolean;
  partnerWith?: string;
  chooseABackground?: boolean;
}

export type SpellCastBehavior =
  | { kind: 'storm' }
  | { kind: 'cascade' };

export type SpellCostMechanic =
  | { kind: 'delve' }
  | { kind: 'convoke' }
  | { kind: 'generic-tap-substitution'; substitution: GenericTapSubstitution };

export interface SpellCost {
  mana: ManaCost;
  mechanics?: SpellCostMechanic[];
}

export interface AlternativeCast {
  id: string;
  cost: Cost;
  zone?: Zone;
  afterResolution?: Zone;
  description: string;
}

export interface AdditionalCost {
  id: string;
  cost: Cost;
  optional: boolean;
  description: string;
}

export interface CastCostAdjustment {
  kind: 'affinity';
  amount: number;
  filter: CardFilter;
  description: string;
}

export interface CardDefinition {
  id: string;
  name: string;
  spellCost: SpellCost;
  colorIdentity: ManaColor[];
  commanderOptions?: CommanderOptions;
  types: CardType[];
  supertypes: string[];
  subtypes: string[];
  power?: number;
  toughness?: number;
  loyalty?: number;
  spell?: SpellDefinition;
  spellCastBehaviors?: SpellCastBehavior[];
  abilities: AbilityDefinition[];
  attachment?: AttachmentDefinition;
  alternativeCosts?: AlternativeCast[];
  additionalCosts?: AdditionalCost[];
  castCostAdjustments?: CastCostAdjustment[];
  backFace?: CardDefinition;
  isMDFC?: boolean;
  sagaChapters?: Array<{ chapter: number; effect: EffectFn }>;
  adventure?: { name: string; spellCost: SpellCost; types: CardType[]; effect: EffectFn };
  splitHalf?: CardDefinition;
  hasFuse?: boolean;
  morphCost?: Cost;
  suspend?: SuspendDefinition;
}
