import type { CardInstance } from '../types/cards';
import type { CardType, ObjectId, Zone } from '../types/core';
import type {
  ContinuousEffect,
  ReplacementEffect,
  WouldEnterBattlefieldReplacementEffect,
  StaticEffectDef,
  EffectDuration,
  GenericReplacementEffectDef,
  WouldEnterBattlefieldReplacementEffectDef,
  CostModificationEffectDef,
} from '../types/effects';
import type { CardFilter, SpellFilter } from '../types/filters';
import type { CompiledInteractionHook, InteractionHookDef } from '../types/interactions';
import type { ManaCost, ManaReductionBudget } from '../types/mana';
import type { GameState } from '../types/state';
import type { GameEvent } from '../types/events';
import { Layer, GameEventType } from '../types';
import { Cost } from '../costs';
import { matchesInteractionSource } from '../InteractionEngine';

// ---------------------------------------------------------------------------
// Profile types (re-exported from AbilityPrimitives for convenience)
// ---------------------------------------------------------------------------

export interface TimingPermissionProfile {
  canCastAsInstant: boolean;
  canActivateAsInstant: boolean;
}

export interface AttackRuleProfile {
  canAttack: boolean;
  ignoreSummoningSickness: boolean;
  attacksWithoutTapping: boolean;
}

export interface ActivationRuleProfile {
  ignoreTapSummoningSickness: boolean;
}

export interface BlockRuleProfile {
  canBlock: boolean;
  canBeBlocked: boolean;
  minBlockers: number;
  hasFlying: boolean;
  canBlockFlying: boolean;
  landwalkSubtypes: string[];
}

export interface CombatDamageRuleProfile {
  hasFirstStrike: boolean;
  hasDoubleStrike: boolean;
  lethalDamageIsOne: boolean;
  marksDeathtouchDamage: boolean;
  excessToDefender: boolean;
  controllerGainsLifeFromDamage: boolean;
}

export interface SurvivalRuleProfile {
  ignoreDestroy: boolean;
  ignoreLethalDamage: boolean;
}

export interface PhaseRuleProfile {
  phasesInDuringUntap: boolean;
  phasesOutDuringUntap: boolean;
}

// ---------------------------------------------------------------------------
// Compilation context
// ---------------------------------------------------------------------------

export interface EffectCompilationContext {
  state: GameState;
  source: CardInstance;
  description: string;
  matchesFilter(card: CardInstance, filter: CardFilter, source: CardInstance, state: GameState): boolean;
  findCardById(state: GameState, objectId: string): CardInstance | undefined;
}

// ---------------------------------------------------------------------------
// StaticEffect interface
// ---------------------------------------------------------------------------

export interface StaticEffect {
  compile(ctx: EffectCompilationContext): ContinuousEffect | null;
  compileReplacement(ctx: EffectCompilationContext, index: number): ReplacementEffect | null;
  compileWouldEnterBattlefieldReplacement(ctx: EffectCompilationContext, index: number): WouldEnterBattlefieldReplacementEffect | null;
  compileSelfReplacement(ctx: EffectCompilationContext, objectId: string, zoneChangeCounter: number, index: number): WouldEnterBattlefieldReplacementEffect | null;
  compileInteractionHook(ctx: EffectCompilationContext, index: number): CompiledInteractionHook | null;

  getCostModification(): {
    costDelta?: Partial<ManaCost>;
    reductionBudget?: ManaReductionBudget;
    spillUnusedColoredToGeneric?: boolean;
    filter: SpellFilter;
  } | null;
  isNoMaxHandSize(): boolean;

  contributeToTimingProfile(profile: TimingPermissionProfile, zone?: Zone): boolean;
  contributeToAttackProfile(profile: AttackRuleProfile): boolean;
  contributeToActivationProfile(profile: ActivationRuleProfile): boolean;
  contributeToBlockProfile(profile: BlockRuleProfile): boolean;
  contributeToCombatDamageProfile(profile: CombatDamageRuleProfile): boolean;
  contributeToSurvivalProfile(profile: SurvivalRuleProfile): boolean;
  contributeToPhaseProfile(profile: PhaseRuleProfile): boolean;
}

// ---------------------------------------------------------------------------
// Base class with default no-ops
// ---------------------------------------------------------------------------

class BaseStaticEffect implements StaticEffect {
  compile(_ctx: EffectCompilationContext): ContinuousEffect | null { return null; }
  compileReplacement(_ctx: EffectCompilationContext, _index: number): ReplacementEffect | null { return null; }
  compileWouldEnterBattlefieldReplacement(_ctx: EffectCompilationContext, _index: number): WouldEnterBattlefieldReplacementEffect | null { return null; }
  compileSelfReplacement(_ctx: EffectCompilationContext, _objectId: string, _zcc: number, _index: number): WouldEnterBattlefieldReplacementEffect | null { return null; }
  compileInteractionHook(_ctx: EffectCompilationContext, _index: number): CompiledInteractionHook | null { return null; }
  getCostModification(): {
    costDelta?: Partial<ManaCost>;
    reductionBudget?: ManaReductionBudget;
    spillUnusedColoredToGeneric?: boolean;
    filter: SpellFilter;
  } | null { return null; }
  isNoMaxHandSize(): boolean { return false; }
  contributeToTimingProfile(_profile: TimingPermissionProfile, _zone?: Zone): boolean { return false; }
  contributeToAttackProfile(_profile: AttackRuleProfile): boolean { return false; }
  contributeToActivationProfile(_profile: ActivationRuleProfile): boolean { return false; }
  contributeToBlockProfile(_profile: BlockRuleProfile): boolean { return false; }
  contributeToCombatDamageProfile(_profile: CombatDamageRuleProfile): boolean { return false; }
  contributeToSurvivalProfile(_profile: SurvivalRuleProfile): boolean { return false; }
  contributeToPhaseProfile(_profile: PhaseRuleProfile): boolean { return false; }
}

// ---------------------------------------------------------------------------
// Concrete effect classes
// ---------------------------------------------------------------------------

class PumpEffect extends BaseStaticEffect {
  private def: { power: number; toughness: number; filter: CardFilter; duration?: EffectDuration };
  constructor(def: { power: number; toughness: number; filter: CardFilter; duration?: EffectDuration }) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect {
    const { source, description, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:pump:${description}`,
      sourceId: source.objectId,
      layer: Layer.PT_MODIFY,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => ctx.matchesFilter(permanent, def.filter, source, state),
      apply: permanent => {
        permanent.modifiedPower = (permanent.modifiedPower ?? permanent.definition.power ?? 0) + def.power;
        permanent.modifiedToughness = (permanent.modifiedToughness ?? permanent.definition.toughness ?? 0) + def.toughness;
      },
    };
  }
}

class AttachedPumpEffect extends BaseStaticEffect {
  private def: {
    power: number | ((game: GameState, source: CardInstance) => number);
    toughness: number | ((game: GameState, source: CardInstance) => number);
  };
  constructor(def: AttachedPumpEffect['def']) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect | null {
    const { source, description, state } = ctx;
    if (!source.attachedTo) return null;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:attached-pump:${description}`,
      sourceId: source.objectId,
      layer: Layer.PT_MODIFY,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => permanent.objectId === source.attachedTo,
      apply: permanent => {
        const power = typeof def.power === 'function' ? def.power(state, source) : def.power;
        const toughness = typeof def.toughness === 'function' ? def.toughness(state, source) : def.toughness;
        permanent.modifiedPower = (permanent.modifiedPower ?? permanent.definition.power ?? 0) + power;
        permanent.modifiedToughness = (permanent.modifiedToughness ?? permanent.definition.toughness ?? 0) + toughness;
      },
    };
  }
}

class SetBasePTEffect extends BaseStaticEffect {
  private def: {
    power: number | ((game: GameState, source: CardInstance) => number);
    toughness: number | ((game: GameState, source: CardInstance) => number);
    filter: CardFilter;
    layer?: 'cda' | 'set';
  };
  constructor(def: SetBasePTEffect['def']) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect {
    const { source, description, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:set-base-pt:${description}`,
      sourceId: source.objectId,
      layer: def.layer === 'cda' ? Layer.PT_CDA : Layer.PT_SET,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => ctx.matchesFilter(permanent, def.filter, source, state),
      apply: permanent => {
        permanent.modifiedPower = typeof def.power === 'function' ? def.power(state, source) : def.power;
        permanent.modifiedToughness = typeof def.toughness === 'function' ? def.toughness(state, source) : def.toughness;
      },
    };
  }
}

class AddTypesEffect extends BaseStaticEffect {
  private def: { types: CardType[]; filter: CardFilter };
  constructor(def: { types: CardType[]; filter: CardFilter }) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect {
    const { source, description, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:add-types:${description}`,
      sourceId: source.objectId,
      layer: Layer.TYPE,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => ctx.matchesFilter(permanent, def.filter, source, state),
      apply: permanent => {
        const types = permanent.modifiedTypes ?? [...permanent.definition.types];
        for (const type of def.types) {
          if (!types.includes(type)) types.push(type);
        }
        permanent.modifiedTypes = types;
      },
    };
  }
}

class GrantAbilitiesEffect extends BaseStaticEffect {
  constructor(def: { abilities: import('../types/abilities').AbilityDefinition[]; filter: CardFilter }) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect {
    const { source, description, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:grant-abilities:${description}`,
      sourceId: source.objectId,
      layer: Layer.ABILITY,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => ctx.matchesFilter(permanent, def.filter, source, state),
      apply: permanent => {
        const abilities = permanent.modifiedAbilities ?? [...permanent.definition.abilities];
        abilities.push(...def.abilities);
        permanent.modifiedAbilities = abilities;
      },
    };
  }
}

class CostModificationEffect extends BaseStaticEffect {
  private def: CostModificationEffectDef;
  constructor(def: CostModificationEffectDef) { super(); this.def = def; }

  getCostModification() {
    return {
      costDelta: this.def.costDelta,
      reductionBudget: this.def.reductionBudget,
      spillUnusedColoredToGeneric: this.def.spillUnusedColoredToGeneric,
      filter: this.def.filter,
    };
  }
}

class AttackTaxEffect extends BaseStaticEffect {
  constructor(def: { filter: CardFilter; cost: import('../types/costs').PlainCost; defender: 'source-controller' }) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect {
    const { source, description, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:attack-tax:${description}`,
      sourceId: source.objectId,
      layer: Layer.ABILITY,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => ctx.matchesFilter(permanent, def.filter, source, state),
      apply: permanent => {
        permanent.attackTaxes ??= [];
        permanent.attackTaxes.push({
          sourceId: source.objectId,
          defender: def.defender === 'source-controller' ? source.controller : source.controller,
          cost: Cost.from(def.cost).toPlainCost(),
        });
      },
    };
  }
}

class TimingPermissionEffect extends BaseStaticEffect {
  private def: { scope: 'spell' | 'activated-ability' | 'all'; anyTimeCouldCastInstant?: boolean; zones?: Zone[] };
  constructor(def: { scope: 'spell' | 'activated-ability' | 'all'; anyTimeCouldCastInstant?: boolean; zones?: Zone[] }) { super(); this.def = def; }

  contributeToTimingProfile(profile: TimingPermissionProfile, zone?: Zone): boolean {
    if (zone && this.def.zones?.length && !this.def.zones.includes(zone)) return false;
    if (!this.def.anyTimeCouldCastInstant) return false;
    if (this.def.scope === 'spell' || this.def.scope === 'all') profile.canCastAsInstant = true;
    if (this.def.scope === 'activated-ability' || this.def.scope === 'all') profile.canActivateAsInstant = true;
    return true;
  }
}

class AttackRuleEffect extends BaseStaticEffect {
  private def: { canAttack?: boolean; ignoreSummoningSickness?: boolean; attacksWithoutTapping?: boolean };
  constructor(def: { canAttack?: boolean; ignoreSummoningSickness?: boolean; attacksWithoutTapping?: boolean }) { super(); this.def = def; }

  contributeToAttackProfile(profile: AttackRuleProfile): boolean {
    if (this.def.canAttack === false) profile.canAttack = false;
    if (this.def.ignoreSummoningSickness) profile.ignoreSummoningSickness = true;
    if (this.def.attacksWithoutTapping) profile.attacksWithoutTapping = true;
    return true;
  }
}

class ActivationRuleEffect extends BaseStaticEffect {
  private def: { ignoreTapSummoningSickness?: boolean };
  constructor(def: { ignoreTapSummoningSickness?: boolean }) { super(); this.def = def; }

  contributeToActivationProfile(profile: ActivationRuleProfile): boolean {
    if (this.def.ignoreTapSummoningSickness) profile.ignoreTapSummoningSickness = true;
    return true;
  }
}

class BlockRuleEffect extends BaseStaticEffect {
  private def: {
    canBlock?: boolean; canBeBlocked?: boolean; minBlockers?: number;
    evasion?: 'requires-flying-or-reach'; canBlockIfAttackerHas?: 'flying'; landwalkSubtypes?: string[];
  };
  constructor(def: {
    canBlock?: boolean; canBeBlocked?: boolean; minBlockers?: number;
    evasion?: 'requires-flying-or-reach'; canBlockIfAttackerHas?: 'flying'; landwalkSubtypes?: string[];
  }) { super(); this.def = def; }

  contributeToBlockProfile(profile: BlockRuleProfile): boolean {
    if (this.def.canBlock === false) profile.canBlock = false;
    if (this.def.canBeBlocked === false) profile.canBeBlocked = false;
    if (this.def.minBlockers !== undefined) profile.minBlockers = Math.max(profile.minBlockers, this.def.minBlockers);
    if (this.def.evasion === 'requires-flying-or-reach') { profile.hasFlying = true; profile.canBlockFlying = true; }
    if (this.def.canBlockIfAttackerHas === 'flying') profile.canBlockFlying = true;
    for (const subtype of this.def.landwalkSubtypes ?? []) {
      if (!profile.landwalkSubtypes.includes(subtype)) profile.landwalkSubtypes.push(subtype);
    }
    return true;
  }
}

class CombatDamageRuleEffect extends BaseStaticEffect {
  private def: {
    combatDamageStep?: 'first-strike' | 'double-strike'; lethalDamageIsOne?: boolean;
    marksDeathtouchDamage?: boolean; excessToDefender?: boolean; controllerGainsLifeFromDamage?: boolean;
  };
  constructor(def: {
    combatDamageStep?: 'first-strike' | 'double-strike'; lethalDamageIsOne?: boolean;
    marksDeathtouchDamage?: boolean; excessToDefender?: boolean; controllerGainsLifeFromDamage?: boolean;
  }) { super(); this.def = def; }

  contributeToCombatDamageProfile(profile: CombatDamageRuleProfile): boolean {
    if (this.def.combatDamageStep === 'first-strike') profile.hasFirstStrike = true;
    if (this.def.combatDamageStep === 'double-strike') { profile.hasFirstStrike = true; profile.hasDoubleStrike = true; }
    if (this.def.lethalDamageIsOne) profile.lethalDamageIsOne = true;
    if (this.def.marksDeathtouchDamage) profile.marksDeathtouchDamage = true;
    if (this.def.excessToDefender) profile.excessToDefender = true;
    if (this.def.controllerGainsLifeFromDamage) profile.controllerGainsLifeFromDamage = true;
    return true;
  }
}

class SurvivalRuleEffect extends BaseStaticEffect {
  private def: { ignoreDestroy?: boolean; ignoreLethalDamage?: boolean };
  constructor(def: { ignoreDestroy?: boolean; ignoreLethalDamage?: boolean }) { super(); this.def = def; }

  contributeToSurvivalProfile(profile: SurvivalRuleProfile): boolean {
    if (this.def.ignoreDestroy) profile.ignoreDestroy = true;
    if (this.def.ignoreLethalDamage) profile.ignoreLethalDamage = true;
    return true;
  }
}

class PhaseRuleEffect extends BaseStaticEffect {
  private def: { phasesInDuringUntap?: boolean; phasesOutDuringUntap?: boolean };
  constructor(def: { phasesInDuringUntap?: boolean; phasesOutDuringUntap?: boolean }) { super(); this.def = def; }

  contributeToPhaseProfile(profile: PhaseRuleProfile): boolean {
    if (this.def.phasesInDuringUntap) profile.phasesInDuringUntap = true;
    if (this.def.phasesOutDuringUntap) profile.phasesOutDuringUntap = true;
    return true;
  }
}

class NoMaxHandSizeEffect extends BaseStaticEffect {
  isNoMaxHandSize(): boolean { return true; }
}

class CantBeTargetedEffect extends BaseStaticEffect {
  private def: { by: 'opponents'; filter: CardFilter };
  constructor(def: { by: 'opponents'; filter: CardFilter }) { super(); this.def = def; }

  compileInteractionHook(ctx: EffectCompilationContext, index: number): CompiledInteractionHook {
    return compileInteractionHookFromDef(ctx, {
      type: 'forbid',
      interactions: ['target'],
      phases: ['candidate', 'revalidate'],
      filter: this.def.filter,
      source: { controller: 'opponents' },
    }, index);
  }
}

class InteractionHookEffect extends BaseStaticEffect {
  private hook: InteractionHookDef;
  constructor(hook: InteractionHookDef) { super(); this.hook = hook; }

  compileInteractionHook(ctx: EffectCompilationContext, index: number): CompiledInteractionHook {
    return compileInteractionHookFromDef(ctx, this.hook, index);
  }
}

class GenericReplacementEffect extends BaseStaticEffect {
  private def: GenericReplacementEffectDef;
  constructor(def: GenericReplacementEffectDef) { super(); this.def = def; }

  compileReplacement(ctx: EffectCompilationContext, index: number): ReplacementEffect | null {
    if (this.def.selfReplacement) return null;
    const { source } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:replacement:${index}`,
      sourceId: source.objectId,
      isSelfReplacement: false,
      appliesTo: (event) => matchesReplacementEvent(def.replaces, event.type) && source.zone === 'BATTLEFIELD',
      replace: (event, game) => def.replace(game, source, event),
    };
  }
}

class WouldEnterBattlefieldReplacementEffectImpl extends BaseStaticEffect {
  private def: WouldEnterBattlefieldReplacementEffectDef;
  constructor(def: WouldEnterBattlefieldReplacementEffectDef) { super(); this.def = def; }

  compileWouldEnterBattlefieldReplacement(ctx: EffectCompilationContext, index: number): WouldEnterBattlefieldReplacementEffect | null {
    if (this.def.selfReplacement) return null;
    const { source } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:would-enter:${index}`,
      sourceId: source.objectId,
      isSelfReplacement: false,
      appliesTo: () => source.zone === 'BATTLEFIELD',
      replace: (event, game) => def.replace(game, source, event),
    };
  }

  compileSelfReplacement(ctx: EffectCompilationContext, objectId: string, zoneChangeCounter: number, index: number): WouldEnterBattlefieldReplacementEffect | null {
    if (!this.def.selfReplacement) return null;
    const { source } = ctx;
    const def = this.def;
    return {
      id: `${objectId}:${zoneChangeCounter}:self-replacement:${index}`,
      sourceId: objectId,
      isSelfReplacement: true,
      appliesTo: event => event.objectId === objectId && event.objectZoneChangeCounter === zoneChangeCounter,
      replace: (event, game) => def.replace(game, source, event),
    };
  }
}

class PreventionEffect extends BaseStaticEffect {
  private def: { prevents: 'damage' | 'combat-damage'; filter?: CardFilter };
  constructor(def: { prevents: 'damage' | 'combat-damage'; filter?: CardFilter }) { super(); this.def = def; }

  compileReplacement(ctx: EffectCompilationContext, index: number): ReplacementEffect {
    const { source, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:prevention:${index}`,
      sourceId: source.objectId,
      isSelfReplacement: false,
      appliesTo: (event, game) => {
        if (event.type !== GameEventType.DAMAGE_DEALT) return false;
        if (def.prevents === 'combat-damage' && !event.isCombatDamage) return false;
        if (def.prevents === 'damage' || event.isCombatDamage) {
          if (typeof event.targetId === 'string' && event.targetId.startsWith('player')) return false;
          const target = ctx.findCardById(game, event.targetId as string);
          if (!target) return false;
          return !def.filter || ctx.matchesFilter(target, def.filter, source, game);
        }
        return false;
      },
      replace: () => null,
    };
  }
}

class CantAttackEffect extends BaseStaticEffect {}
class CantBlockEffect extends BaseStaticEffect {}

class CustomEffect extends BaseStaticEffect {
  constructor(def: { apply: (game: GameState, source: CardInstance) => void }) { super(); this.def = def; }

  compile(ctx: EffectCompilationContext): ContinuousEffect {
    const { source, description, state } = ctx;
    const def = this.def;
    return {
      id: `${source.objectId}:${source.zoneChangeCounter}:custom:${description}`,
      sourceId: source.objectId,
      layer: Layer.ABILITY,
      timestamp: source.timestamp,
      duration: { type: 'static', sourceId: source.objectId },
      appliesTo: permanent => permanent.objectId === source.objectId && permanent.zoneChangeCounter === source.zoneChangeCounter,
      apply: () => { def.apply(state, source); },
    };
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function staticEffectFrom(def: StaticEffectDef): StaticEffect {
  switch (def.type) {
    case 'pump': return new PumpEffect(def);
    case 'attached-pump': return new AttachedPumpEffect(def);
    case 'set-base-pt': return new SetBasePTEffect(def);
    case 'add-types': return new AddTypesEffect(def);
    case 'grant-abilities': return new GrantAbilitiesEffect(def);
    case 'cost-modification': return new CostModificationEffect(def);
    case 'attack-tax': return new AttackTaxEffect(def);
    case 'timing-permission': return new TimingPermissionEffect(def);
    case 'attack-rule': return new AttackRuleEffect(def);
    case 'activation-rule': return new ActivationRuleEffect(def);
    case 'block-rule': return new BlockRuleEffect(def);
    case 'combat-damage-rule': return new CombatDamageRuleEffect(def);
    case 'survival-rule': return new SurvivalRuleEffect(def);
    case 'phase-rule': return new PhaseRuleEffect(def);
    case 'cant-attack': return new CantAttackEffect();
    case 'cant-block': return new CantBlockEffect();
    case 'no-max-hand-size': return new NoMaxHandSizeEffect();
    case 'cant-be-targeted': return new CantBeTargetedEffect(def);
    case 'interaction-hook': return new InteractionHookEffect(def.hook);
    case 'replacement':
      return def.replaces === 'would-enter-battlefield'
        ? new WouldEnterBattlefieldReplacementEffectImpl(def as WouldEnterBattlefieldReplacementEffectDef)
        : new GenericReplacementEffect(def as GenericReplacementEffectDef);
    case 'prevention': return new PreventionEffect(def);
    case 'custom': return new CustomEffect(def);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function compileInteractionHookFromDef(
  ctx: EffectCompilationContext,
  hook: InteractionHookDef,
  index: number,
): CompiledInteractionHook {
  const { source, description, state } = ctx;
  const id = `${source.objectId}:${source.zoneChangeCounter}:interaction:${index}:${description}`;
  return {
    id,
    sourceId: source.objectId,
    appliesTo: object => ctx.matchesFilter(object, hook.filter, source, state),
    evaluate: (ictx) => {
      if (hook.type === 'forbid') {
        if (!hook.interactions.includes(ictx.kind)) return null;
        if (hook.phases && !hook.phases.includes(ictx.phase)) return null;
        if (!matchesInteractionSource(hook.source, ictx)) return null;
        return { kind: 'forbid', reason: hook.reason };
      }

      if (ictx.kind !== hook.interaction) return null;
      if (ictx.phase !== (hook.phase ?? 'lock')) return null;
      if (!matchesInteractionSource(hook.source, ictx)) return null;

      const scope = hook.requirementScope ?? 'object-instance';
      const requirementId = scope === 'source-and-object-instance'
        ? `${id}:${ictx.actor.objectId}:${ictx.actor.zoneChangeCounter}:${ictx.object.objectId}:${ictx.object.zoneChangeCounter}`
        : `${id}:${ictx.object.objectId}:${ictx.object.zoneChangeCounter}`;

      return {
        kind: 'require',
        requirement: {
          id: requirementId,
          prompt: hook.prompt ?? `Pay for ${ictx.object.definition.name}?`,
          cost: Cost.from(hook.cost).toPlainCost(),
          onFailure: hook.onFailure,
        },
      };
    },
  };
}

function matchesReplacementEvent(
  replaces: import('../types/effects').ReplacementEventType,
  eventType: import('../types/events').GameEventType,
): boolean {
  switch (replaces) {
    case 'deal-damage': return eventType === GameEventType.DAMAGE_DEALT;
    case 'create-token': return eventType === GameEventType.TOKEN_CREATED;
    case 'place-counters': return eventType === GameEventType.COUNTER_ADDED;
    case 'draw-card': return eventType === GameEventType.DREW_CARD;
    case 'discard': return eventType === GameEventType.DISCARDED;
    case 'dies': return eventType === GameEventType.ZONE_CHANGE;
  }
  return false;
}
