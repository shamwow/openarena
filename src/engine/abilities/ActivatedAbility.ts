import type { CardInstance } from '../types/cards';
import type { Zone } from '../types/core';
import type { EffectFn } from '../types/effects';
import type { ManaProduction, TrackedManaEffect } from '../types/mana';
import type { TargetSpec } from '../types/targeting';
import type { ActivatedAbilityDef } from '../types/abilities';
import { Cost } from '../costs';

export class ActivatedAbility {
  readonly kind = 'activated' as const;
  private _cost: Cost;
  private _effect: EffectFn;
  private _targets: TargetSpec[] | undefined;
  private _timing: 'instant' | 'sorcery';
  private _isManaAbility: boolean;
  private _activationZone: Zone | undefined;
  private _activateOnlyDuringYourTurn: boolean;
  private _manaProduction: ManaProduction[] | undefined;
  private _trackedManaEffect: TrackedManaEffect | undefined;
  private _isExhaust: boolean;
  private _description: string;

  private constructor() {
    this._cost = Cost.empty();
    this._effect = () => {};
    this._timing = 'instant';
    this._isManaAbility = false;
    this._activateOnlyDuringYourTurn = false;
    this._isExhaust = false;
    this._description = '';
  }

  static from(def: ActivatedAbilityDef): ActivatedAbility {
    const a = new ActivatedAbility();
    a._cost = Cost.from(def.cost);
    a._effect = def.effect;
    a._targets = def.targets;
    a._timing = def.timing;
    a._isManaAbility = def.isManaAbility;
    a._activationZone = def.activationZone;
    a._activateOnlyDuringYourTurn = def.activateOnlyDuringYourTurn ?? false;
    a._manaProduction = def.manaProduction;
    a._trackedManaEffect = def.trackedManaEffect;
    a._isExhaust = def.isExhaust ?? false;
    a._description = def.description;
    return a;
  }

  /** Returns a cloned Cost for payment (safe to mutate). */
  createPaymentCost(): Cost { return this._cost.clone(); }

  /** Does this cost require tapping the source? */
  requiresTap(): boolean { return this._cost.requiresTap(); }

  /** Does this cost require sacrificing the source? */
  requiresSelfSacrifice(): boolean {
    // Delegate to the PlainCost — check via toPlainCost()
    const plain = this._cost.toPlainCost();
    return Boolean(plain.sacrifice?.self);
  }

  isManaAbility(): boolean { return this._isManaAbility; }
  isExhaust(): boolean { return this._isExhaust; }
  getActivationZone(): Zone { return this._activationZone ?? 'BATTLEFIELD'; }
  getTiming(): 'instant' | 'sorcery' { return this._timing; }
  isActivateOnlyDuringYourTurn(): boolean { return this._activateOnlyDuringYourTurn; }
  getEffect(): EffectFn { return this._effect; }
  getTargetSpecs(): TargetSpec[] | undefined { return this._targets; }
  getManaProduction(): ManaProduction[] | undefined { return this._manaProduction; }
  getTrackedManaEffect(): TrackedManaEffect | undefined { return this._trackedManaEffect; }
  getDescription(): string { return this._description; }
}
