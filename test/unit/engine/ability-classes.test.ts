import assert from 'node:assert/strict';
import test from 'node:test';

import { StaticAbility } from '../../../src/engine/abilities/StaticAbility.ts';
import { TriggeredAbility } from '../../../src/engine/abilities/TriggeredAbility.ts';
import { ActivatedAbility } from '../../../src/engine/abilities/ActivatedAbility.ts';
import { staticEffectFrom } from '../../../src/engine/effects/StaticEffect.ts';
import { parseManaCost } from '../../../src/engine/types/mana.ts';
import type { StaticAbilityDef, TriggeredAbilityDef, ActivatedAbilityDef } from '../../../src/engine/types/abilities.ts';
import type { CardInstance } from '../../../src/engine/types/cards.ts';
import type { GameState } from '../../../src/engine/types/state.ts';
import type { GameEvent } from '../../../src/engine/types/events.ts';

// =============================================================================
// StaticAbility
// =============================================================================

test('StaticAbility.from() preserves kind and description', () => {
  const def: StaticAbilityDef = {
    kind: 'static',
    effect: { type: 'attack-rule', ignoreSummoningSickness: true },
    description: 'Haste',
  };
  const sa = StaticAbility.from(def);
  assert.equal(sa.kind, 'static');
  assert.equal(sa.getDescription(), 'Haste');
});

test('StaticAbility.isActive() returns true when no condition', () => {
  const sa = StaticAbility.from({
    kind: 'static',
    effect: { type: 'no-max-hand-size' },
    description: 'No maximum hand size',
  });
  assert.equal(sa.isActive({} as GameState, {} as CardInstance), true);
});

test('StaticAbility.isActive() delegates to condition function', () => {
  let conditionCalled = false;
  const sa = StaticAbility.from({
    kind: 'static',
    effect: { type: 'no-max-hand-size' },
    condition: () => { conditionCalled = true; return false; },
    description: 'Conditional',
  });
  assert.equal(sa.isActive({} as GameState, {} as CardInstance), false);
  assert.equal(conditionCalled, true);
});

test('StaticAbility.isNoMaxHandSize() returns true for no-max-hand-size effect', () => {
  const sa = StaticAbility.from({
    kind: 'static',
    effect: { type: 'no-max-hand-size' },
    description: 'Reliquary Tower',
  });
  assert.equal(sa.isNoMaxHandSize(), true);
});

test('StaticAbility.isNoMaxHandSize() returns false for other effects', () => {
  const sa = StaticAbility.from({
    kind: 'static',
    effect: { type: 'attack-rule', canAttack: false },
    description: 'Defender',
  });
  assert.equal(sa.isNoMaxHandSize(), false);
});

test('StaticAbility.getCostModification() returns delta and filter for cost-modification', () => {
  const sa = StaticAbility.from({
    kind: 'static',
    effect: { type: 'cost-modification', costDelta: { generic: -1 }, filter: { controller: 'you' } },
    description: 'Cost reducer',
  });
  const mod = sa.getCostModification();
  assert.ok(mod);
  assert.ok(mod.costDelta);
  assert.equal(mod.costDelta.generic, -1);
  assert.equal(mod.filter.controller, 'you');
});

test('StaticAbility.getCostModification() returns null for non-cost effects', () => {
  const sa = StaticAbility.from({
    kind: 'static',
    effect: { type: 'pump', power: 1, toughness: 1, filter: {} },
    description: 'Lord',
  });
  assert.equal(sa.getCostModification(), null);
});

// =============================================================================
// StaticEffect profile contributions
// =============================================================================

test('AttackRuleEffect contributes to attack profile', () => {
  const effect = staticEffectFrom({ type: 'attack-rule', ignoreSummoningSickness: true, attacksWithoutTapping: true });
  const profile = { canAttack: true, ignoreSummoningSickness: false, attacksWithoutTapping: false };
  assert.equal(effect.contributeToAttackProfile(profile), true);
  assert.equal(profile.ignoreSummoningSickness, true);
  assert.equal(profile.attacksWithoutTapping, true);
});

test('BlockRuleEffect contributes flying and minBlockers to block profile', () => {
  const effect = staticEffectFrom({ type: 'block-rule', evasion: 'requires-flying-or-reach', minBlockers: 2 });
  const profile = { canBlock: true, canBeBlocked: true, minBlockers: 1, hasFlying: false, canBlockFlying: false, landwalkSubtypes: [] as string[] };
  effect.contributeToBlockProfile(profile);
  assert.equal(profile.hasFlying, true);
  assert.equal(profile.canBlockFlying, true);
  assert.equal(profile.minBlockers, 2);
});

test('CombatDamageRuleEffect contributes double strike', () => {
  const effect = staticEffectFrom({ type: 'combat-damage-rule', combatDamageStep: 'double-strike' });
  const profile = { hasFirstStrike: false, hasDoubleStrike: false, lethalDamageIsOne: false, marksDeathtouchDamage: false, excessToDefender: false, controllerGainsLifeFromDamage: false };
  effect.contributeToCombatDamageProfile(profile);
  assert.equal(profile.hasFirstStrike, true);
  assert.equal(profile.hasDoubleStrike, true);
});

test('SurvivalRuleEffect contributes indestructible', () => {
  const effect = staticEffectFrom({ type: 'survival-rule', ignoreDestroy: true, ignoreLethalDamage: true });
  const profile = { ignoreDestroy: false, ignoreLethalDamage: false };
  effect.contributeToSurvivalProfile(profile);
  assert.equal(profile.ignoreDestroy, true);
  assert.equal(profile.ignoreLethalDamage, true);
});

test('TimingPermissionEffect contributes flash', () => {
  const effect = staticEffectFrom({ type: 'timing-permission', scope: 'all', anyTimeCouldCastInstant: true });
  const profile = { canCastAsInstant: false, canActivateAsInstant: false };
  effect.contributeToTimingProfile(profile);
  assert.equal(profile.canCastAsInstant, true);
  assert.equal(profile.canActivateAsInstant, true);
});

test('TimingPermissionEffect respects zone filter', () => {
  const effect = staticEffectFrom({ type: 'timing-permission', scope: 'spell', anyTimeCouldCastInstant: true, zones: ['HAND'] });
  const profile = { canCastAsInstant: false, canActivateAsInstant: false };
  effect.contributeToTimingProfile(profile, 'BATTLEFIELD');
  assert.equal(profile.canCastAsInstant, false, 'should not contribute for wrong zone');
});

test('Non-matching effect returns false from profile contribution', () => {
  const effect = staticEffectFrom({ type: 'pump', power: 1, toughness: 1, filter: {} });
  const profile = { canAttack: true, ignoreSummoningSickness: false, attacksWithoutTapping: false };
  assert.equal(effect.contributeToAttackProfile(profile), false);
  assert.equal(profile.ignoreSummoningSickness, false, 'should not modify profile');
});

// =============================================================================
// TriggeredAbility
// =============================================================================

test('TriggeredAbility.from() preserves properties', () => {
  const def: TriggeredAbilityDef = {
    kind: 'triggered',
    trigger: { on: 'enter-battlefield' },
    effect: async () => {},
    optional: false,
    isManaAbility: true,
    oncePerTurn: true,
    description: 'ETB trigger',
  };
  const ta = TriggeredAbility.from(def);
  assert.equal(ta.kind, 'triggered');
  assert.equal(ta.isManaAbility(), true);
  assert.equal(ta.isOncePerTurn(), true);
  assert.equal(ta.isOptional(), false);
  assert.equal(ta.getDescription(), 'ETB trigger');
});

test('TriggeredAbility.matches() returns true for matching enter-battlefield event', () => {
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'enter-battlefield' },
    effect: async () => {},
    optional: false,
    description: 'ETB',
  });
  const source = { objectId: 'src', zoneChangeCounter: 1, controller: 'player1', definition: { name: 'Test' } } as unknown as CardInstance;
  const event = { type: 'ENTERS_BATTLEFIELD', objectId: 'target', objectZoneChangeCounter: 1 } as unknown as GameEvent;
  const state = {} as GameState;
  assert.equal(ta.matches(event, source, state), true);
});

test('TriggeredAbility.matches() returns false for non-matching event type', () => {
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'enter-battlefield' },
    effect: async () => {},
    optional: false,
    description: 'ETB',
  });
  const source = { objectId: 'src', controller: 'player1' } as unknown as CardInstance;
  const event = { type: 'SPELL_CAST' } as unknown as GameEvent;
  assert.equal(ta.matches(event, source, {} as GameState), false);
});

test('TriggeredAbility.matches() checks intervening-if', () => {
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'upkeep' },
    effect: async () => {},
    interveningIf: () => false,
    optional: false,
    description: 'Upkeep check',
  });
  const source = { objectId: 'src', controller: 'player1' } as unknown as CardInstance;
  const event = { type: 'STEP_CHANGE', step: 'UPKEEP', activePlayer: 'player1' } as unknown as GameEvent;
  assert.equal(ta.matches(event, source, {} as GameState), false);
});

test('TriggeredAbility.matches() upkeep trigger checks turn owner', () => {
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'upkeep', whose: 'yours' },
    effect: async () => {},
    optional: false,
    description: 'Your upkeep',
  });
  const source = { objectId: 'src', controller: 'player1' } as unknown as CardInstance;
  const myUpkeep = { type: 'STEP_CHANGE', step: 'UPKEEP', activePlayer: 'player1' } as unknown as GameEvent;
  const opponentUpkeep = { type: 'STEP_CHANGE', step: 'UPKEEP', activePlayer: 'player2' } as unknown as GameEvent;
  assert.equal(ta.matches(myUpkeep, source, {} as GameState), true);
  assert.equal(ta.matches(opponentUpkeep, source, {} as GameState), false);
});

test('TriggeredAbility.matches() custom trigger delegates to match function', () => {
  let matchCalled = false;
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'custom', match: () => { matchCalled = true; return true; } },
    effect: async () => {},
    optional: false,
    description: 'Custom',
  });
  const source = { objectId: 'src', controller: 'player1' } as unknown as CardInstance;
  assert.equal(ta.matches({ type: 'SOME_EVENT' } as unknown as GameEvent, source, {} as GameState), true);
  assert.equal(matchCalled, true);
});

test('TriggeredAbility.matchesTapForManaTrigger() returns true for matching trigger without filter', () => {
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'tap-for-mana' },
    effect: async () => {},
    isManaAbility: true,
    manaProduction: [{ amount: 1, colors: ['G' as any] }],
    optional: false,
    description: 'Tap bonus',
  });
  assert.equal(ta.matchesTapForManaTrigger({} as CardInstance, 'player1', {} as GameState), true);
});

test('TriggeredAbility.matchesTapForManaTrigger() returns false for non-tap-for-mana triggers', () => {
  const ta = TriggeredAbility.from({
    kind: 'triggered',
    trigger: { on: 'enter-battlefield' },
    effect: async () => {},
    isManaAbility: true,
    manaProduction: [{ amount: 1, colors: ['G' as any] }],
    optional: false,
    description: 'ETB mana',
  });
  assert.equal(ta.matchesTapForManaTrigger({} as CardInstance, 'player1', {} as GameState), false);
});

// =============================================================================
// ActivatedAbility
// =============================================================================

test('ActivatedAbility.from() preserves properties', () => {
  const def: ActivatedAbilityDef = {
    kind: 'activated',
    cost: { tap: true, mana: parseManaCost('{2}') },
    effect: async () => {},
    timing: 'instant',
    isManaAbility: true,
    activationZone: 'BATTLEFIELD',
    manaProduction: [{ amount: 1, colors: ['G' as any] }],
    isExhaust: false,
    description: 'Tap for mana',
  };
  const aa = ActivatedAbility.from(def);
  assert.equal(aa.kind, 'activated');
  assert.equal(aa.isManaAbility(), true);
  assert.equal(aa.isExhaust(), false);
  assert.equal(aa.requiresTap(), true);
  assert.equal(aa.getActivationZone(), 'BATTLEFIELD');
  assert.equal(aa.getTiming(), 'instant');
  assert.equal(aa.getDescription(), 'Tap for mana');
  assert.deepEqual(aa.getManaProduction(), [{ amount: 1, colors: ['G'] }]);
});

test('ActivatedAbility.createPaymentCost() returns an independent clone', () => {
  const aa = ActivatedAbility.from({
    kind: 'activated',
    cost: { mana: parseManaCost('{3}') },
    effect: async () => {},
    timing: 'instant',
    isManaAbility: false,
    description: 'Ability',
  });
  const cost1 = aa.createPaymentCost();
  const cost2 = aa.createPaymentCost();
  cost1.addManaTax({ generic: 10 });
  assert.equal(cost1.getManaValue(), 13);
  assert.equal(cost2.getManaValue(), 3, 'second clone should be unaffected');
});

test('ActivatedAbility.requiresTap() reflects the cost', () => {
  const withTap = ActivatedAbility.from({
    kind: 'activated',
    cost: { tap: true },
    effect: async () => {},
    timing: 'instant',
    isManaAbility: false,
    description: 'Tap ability',
  });
  const withoutTap = ActivatedAbility.from({
    kind: 'activated',
    cost: { mana: parseManaCost('{1}') },
    effect: async () => {},
    timing: 'instant',
    isManaAbility: false,
    description: 'Non-tap ability',
  });
  assert.equal(withTap.requiresTap(), true);
  assert.equal(withoutTap.requiresTap(), false);
});

test('ActivatedAbility.requiresSelfSacrifice() detects sacrifice: { self: true }', () => {
  const withSac = ActivatedAbility.from({
    kind: 'activated',
    cost: { tap: true, sacrifice: { self: true } },
    effect: async () => {},
    timing: 'instant',
    isManaAbility: false,
    description: 'Sac ability',
  });
  const withoutSac = ActivatedAbility.from({
    kind: 'activated',
    cost: { tap: true },
    effect: async () => {},
    timing: 'instant',
    isManaAbility: false,
    description: 'No sac',
  });
  assert.equal(withSac.requiresSelfSacrifice(), true);
  assert.equal(withoutSac.requiresSelfSacrifice(), false);
});

test('ActivatedAbility defaults activationZone to BATTLEFIELD', () => {
  const aa = ActivatedAbility.from({
    kind: 'activated',
    cost: {},
    effect: async () => {},
    timing: 'instant',
    isManaAbility: false,
    description: 'Default zone',
  });
  assert.equal(aa.getActivationZone(), 'BATTLEFIELD');
});

test('ActivatedAbility preserves activateOnlyDuringYourTurn', () => {
  const aa = ActivatedAbility.from({
    kind: 'activated',
    cost: {},
    effect: async () => {},
    timing: 'sorcery',
    isManaAbility: false,
    activateOnlyDuringYourTurn: true,
    description: 'Your turn only',
  });
  assert.equal(aa.isActivateOnlyDuringYourTurn(), true);
  assert.equal(aa.getTiming(), 'sorcery');
});
