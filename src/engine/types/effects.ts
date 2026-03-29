import type { AbilityDefinition } from './abilities';
import type { CardInstance } from './cards';
import type { CardType, ManaColor, ObjectId, PlayerId, Timestamp, Zone } from './core';
import type { Cost } from './costs';
import type { GameEngine } from './engine';
import type { GameEvent, GameEventType, WouldEnterBattlefieldEvent } from './events';
import type { CardFilter, SpellFilter } from './filters';
import type { InteractionHookDef } from './interactions';
import type { ManaCost, ManaReductionBudget } from './mana';
import type { CardDefinition } from './spells';
import type { GameState } from './state';
import type { TargetSpec } from './targeting';

export type EffectFn = (ctx: EffectContext) => void | Promise<void>;

export interface EffectContext {
  game: GameEngine;
  state: GameState;
  source: CardInstance;
  controller: PlayerId;
  targets: (CardInstance | PlayerId | null)[];
  event?: GameEvent;
  choices: ChoiceHelper;
  xValue?: number;
  castMethod?: string;
  additionalCostsPaid?: string[];
  colorsSpentToCast?: ManaColor[];
  chooseTarget(spec: Omit<TargetSpec, 'count'>): Promise<CardInstance | PlayerId | null>;
  chooseTargets(spec: TargetSpec): Promise<(CardInstance | PlayerId)[]>;
}

export interface ChoiceHelper {
  chooseOne<T>(prompt: string, options: T[], labelFn?: (t: T) => string): Promise<T>;
  chooseN<T>(
    prompt: string,
    options: T[],
    n: number,
    labelFn?: (t: T) => string,
    opts?: { allowDuplicates?: boolean },
  ): Promise<T[]>;
  chooseUpToN<T>(prompt: string, options: T[], n: number, labelFn?: (t: T) => string): Promise<T[]>;
  chooseYesNo(prompt: string): Promise<boolean>;
  chooseTargets(spec: TargetSpec): Promise<(CardInstance | PlayerId)[]>;
  orderObjects<T>(prompt: string, objects: T[], labelFn?: (t: T) => string): Promise<T[]>;
  choosePlayer(prompt: string, options: PlayerId[]): Promise<PlayerId>;
}

export type PredefinedTokenType = 'Treasure' | 'Clue' | 'Food' | 'Blood' | 'Powerstone';

export interface SearchLibraryOptions {
  player: PlayerId;
  chooser?: PlayerId;
  filter: CardFilter;
  destination: Zone;
  count: number;
  optional?: boolean;
  shuffle?: boolean;
  reveal?: boolean;
}

export interface BattlefieldEntryState {
  tapped: boolean;
  faceDown: boolean;
  counters: Record<string, number>;
  attachedTo: ObjectId | null;
  copyOf?: ObjectId;
  transformed?: boolean;
}

export type ReplacementEventType =
  | 'deal-damage' | 'create-token' | 'place-counters'
  | 'draw-card' | 'discard' | 'dies' | 'would-enter-battlefield';

export type GenericReplacementEventType = Exclude<ReplacementEventType, 'would-enter-battlefield'>;

export type ReplacementFn = (
  game: GameState,
  source: CardInstance,
  event: GameEvent
) => GameEvent | null;

export type WouldEnterBattlefieldReplacementResult =
  | { kind: 'enter'; event: WouldEnterBattlefieldEvent }
  | { kind: 'redirect'; toZone: Exclude<Zone, 'BATTLEFIELD'>; toOwner?: PlayerId }
  | { kind: 'prevent' };

export type WouldEnterBattlefieldReplacementFn = (
  game: GameState,
  source: CardInstance,
  event: WouldEnterBattlefieldEvent
) => WouldEnterBattlefieldReplacementResult;

export type GenericReplacementEffectDef = {
  type: 'replacement';
  replaces: GenericReplacementEventType | GameEventType;
  condition?: (game: GameState, source: CardInstance, event: GameEvent) => boolean;
  replace: ReplacementFn;
  selfReplacement?: boolean;
};

export type WouldEnterBattlefieldReplacementEffectDef = {
  type: 'replacement';
  replaces: 'would-enter-battlefield';
  replace: WouldEnterBattlefieldReplacementFn;
  selfReplacement?: boolean;
};

export interface TimingPermissionEffectDef {
  type: 'timing-permission';
  scope: 'spell' | 'activated-ability' | 'all';
  anyTimeCouldCastInstant?: boolean;
  zones?: Zone[];
}

export interface AttackRuleEffectDef {
  type: 'attack-rule';
  canAttack?: boolean;
  ignoreSummoningSickness?: boolean;
  attacksWithoutTapping?: boolean;
}

export interface ActivationRuleEffectDef {
  type: 'activation-rule';
  ignoreTapSummoningSickness?: boolean;
}

export interface BlockRuleEffectDef {
  type: 'block-rule';
  canBlock?: boolean;
  canBeBlocked?: boolean;
  minBlockers?: number;
  evasion?: 'requires-flying-or-reach';
  canBlockIfAttackerHas?: 'flying';
  landwalkSubtypes?: string[];
}

export interface CombatDamageRuleEffectDef {
  type: 'combat-damage-rule';
  combatDamageStep?: 'first-strike' | 'double-strike';
  lethalDamageIsOne?: boolean;
  marksDeathtouchDamage?: boolean;
  excessToDefender?: boolean;
  controllerGainsLifeFromDamage?: boolean;
}

export interface SurvivalRuleEffectDef {
  type: 'survival-rule';
  ignoreDestroy?: boolean;
  ignoreLethalDamage?: boolean;
}

export interface PhaseRuleEffectDef {
  type: 'phase-rule';
  phasesInDuringUntap?: boolean;
  phasesOutDuringUntap?: boolean;
}

export interface CostModificationEffectDef {
  type: 'cost-modification';
  costDelta?: Partial<ManaCost>;
  reductionBudget?: ManaReductionBudget;
  spillUnusedColoredToGeneric?: boolean;
  filter: SpellFilter;
}

export type StaticEffectDef =
  | { type: 'pump'; power: number; toughness: number; filter: CardFilter; duration?: EffectDuration }
  | { type: 'attached-pump'; power: number | ((game: GameState, source: CardInstance) => number); toughness: number | ((game: GameState, source: CardInstance) => number) }
  | {
      type: 'set-base-pt';
      power: number | ((game: GameState, source: CardInstance) => number);
      toughness: number | ((game: GameState, source: CardInstance) => number);
      filter: CardFilter;
      layer?: 'cda' | 'set';
    }
  | { type: 'add-types'; types: CardType[]; filter: CardFilter }
  | { type: 'grant-abilities'; abilities: AbilityDefinition[]; filter: CardFilter }
  | CostModificationEffectDef
  | { type: 'attack-tax'; filter: CardFilter; cost: Cost; defender: 'source-controller' }
  | TimingPermissionEffectDef
  | AttackRuleEffectDef
  | ActivationRuleEffectDef
  | BlockRuleEffectDef
  | CombatDamageRuleEffectDef
  | SurvivalRuleEffectDef
  | PhaseRuleEffectDef
  | { type: 'cant-attack'; filter: CardFilter }
  | { type: 'cant-block'; filter: CardFilter }
  | { type: 'no-max-hand-size' }
  | { type: 'cant-be-targeted'; by: 'opponents'; filter: CardFilter }
  | { type: 'interaction-hook'; hook: InteractionHookDef }
  | GenericReplacementEffectDef
  | WouldEnterBattlefieldReplacementEffectDef
  | { type: 'prevention'; prevents: 'damage' | 'combat-damage'; filter?: CardFilter }
  | { type: 'custom'; apply: (game: GameState, source: CardInstance) => void };

export const Layer = {
  COPY: 1,
  CONTROL: 2,
  TEXT: 3,
  TYPE: 4,
  COLOR: 5,
  ABILITY: 6,
  PT_CDA: 70,
  PT_SET: 71,
  PT_MODIFY: 72,
  PT_COUNTERS: 73,
  PT_SWITCH: 74,
} as const;
export type Layer = (typeof Layer)[keyof typeof Layer];

export interface ContinuousEffect {
  id: ObjectId;
  sourceId: ObjectId;
  layer: Layer;
  timestamp: Timestamp;
  duration: EffectDuration;
  appliesTo: (permanent: CardInstance, game: GameState) => boolean;
  apply: (permanent: CardInstance, game: GameState) => void;
  dependsOn?: ObjectId[];
}

export type EffectDuration =
  | { type: 'static'; sourceId: ObjectId }
  | { type: 'until-end-of-turn' }
  | { type: 'permanent' }
  | { type: 'while-condition'; check: (gs: GameState) => boolean };

export interface ReplacementEffect {
  id: ObjectId;
  sourceId: ObjectId;
  appliesTo: (event: GameEvent, game: GameState) => boolean;
  replace: (event: GameEvent, game: GameState) => GameEvent | GameEvent[] | null;
  isSelfReplacement: boolean;
}

export interface WouldEnterBattlefieldReplacementEffect {
  id: ObjectId;
  sourceId: ObjectId;
  appliesTo: (event: WouldEnterBattlefieldEvent, game: GameState) => boolean;
  replace: (event: WouldEnterBattlefieldEvent, game: GameState) => WouldEnterBattlefieldReplacementResult;
  isSelfReplacement: boolean;
}
