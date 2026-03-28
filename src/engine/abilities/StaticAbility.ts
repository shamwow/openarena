import type { CardInstance } from '../types/cards';
import type { Zone } from '../types/core';
import type {
  ContinuousEffect,
  ReplacementEffect,
  WouldEnterBattlefieldReplacementEffect,
} from '../types/effects';
import type { CompiledInteractionHook } from '../types/interactions';
import type { ManaCost } from '../types/mana';
import type { CardFilter } from '../types/filters';
import type { GameState } from '../types/state';
import type { StaticAbilityDef } from '../types/abilities';
import {
  staticEffectFrom,
  type StaticEffect,
  type EffectCompilationContext,
  type TimingPermissionProfile,
  type AttackRuleProfile,
  type ActivationRuleProfile,
  type BlockRuleProfile,
  type CombatDamageRuleProfile,
  type SurvivalRuleProfile,
  type PhaseRuleProfile,
} from '../effects';

export class StaticAbility {
  readonly kind = 'static' as const;
  private _effect: StaticEffect;
  private _condition: ((game: GameState, source: CardInstance) => boolean) | undefined;
  private _description: string;

  private constructor(effect: StaticEffect, condition: StaticAbility['_condition'], description: string) {
    this._effect = effect;
    this._condition = condition;
    this._description = description;
  }

  static from(def: StaticAbilityDef): StaticAbility {
    return new StaticAbility(
      staticEffectFrom(def.effect),
      def.condition,
      def.description,
    );
  }

  isActive(state: GameState, source: CardInstance): boolean {
    return !this._condition || this._condition(state, source);
  }

  compile(ctx: EffectCompilationContext): ContinuousEffect | null {
    return this._effect.compile(ctx);
  }

  compileReplacement(ctx: EffectCompilationContext, index: number): ReplacementEffect | null {
    return this._effect.compileReplacement(ctx, index);
  }

  compileWouldEnterBattlefieldReplacement(ctx: EffectCompilationContext, index: number): WouldEnterBattlefieldReplacementEffect | null {
    return this._effect.compileWouldEnterBattlefieldReplacement(ctx, index);
  }

  compileSelfReplacement(ctx: EffectCompilationContext, objectId: string, zoneChangeCounter: number, index: number): WouldEnterBattlefieldReplacementEffect | null {
    return this._effect.compileSelfReplacement(ctx, objectId, zoneChangeCounter, index);
  }

  compileInteractionHook(ctx: EffectCompilationContext, index: number): CompiledInteractionHook | null {
    return this._effect.compileInteractionHook(ctx, index);
  }

  getCostModification(): { costDelta: Partial<ManaCost>; filter: CardFilter } | null {
    return this._effect.getCostModification();
  }

  isNoMaxHandSize(): boolean {
    return this._effect.isNoMaxHandSize();
  }

  contributeToTimingProfile(profile: TimingPermissionProfile, zone?: Zone): boolean {
    return this._effect.contributeToTimingProfile(profile, zone);
  }

  contributeToAttackProfile(profile: AttackRuleProfile): boolean {
    return this._effect.contributeToAttackProfile(profile);
  }

  contributeToActivationProfile(profile: ActivationRuleProfile): boolean {
    return this._effect.contributeToActivationProfile(profile);
  }

  contributeToBlockProfile(profile: BlockRuleProfile): boolean {
    return this._effect.contributeToBlockProfile(profile);
  }

  contributeToCombatDamageProfile(profile: CombatDamageRuleProfile): boolean {
    return this._effect.contributeToCombatDamageProfile(profile);
  }

  contributeToSurvivalProfile(profile: SurvivalRuleProfile): boolean {
    return this._effect.contributeToSurvivalProfile(profile);
  }

  contributeToPhaseProfile(profile: PhaseRuleProfile): boolean {
    return this._effect.contributeToPhaseProfile(profile);
  }

  getDescription(): string {
    return this._description;
  }
}
