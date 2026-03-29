import assert from 'node:assert/strict';
import test from 'node:test';

import { Cost } from '../../../src/engine/costs/Cost.ts';
import { parseManaCost, emptyManaCost } from '../../../src/engine/types/mana.ts';
import type { PlainCost } from '../../../src/engine/types/costs.ts';

// =============================================================================
// Cost.from / Cost.empty
// =============================================================================

test('Cost.empty() creates a cost with zero mana value', () => {
  const cost = Cost.empty();
  assert.equal(cost.getManaValue(), 0);
  assert.equal(cost.isEmpty(), true);
  assert.equal(cost.requiresTap(), false);
});

test('Cost.from(undefined) creates an empty cost', () => {
  const cost = Cost.from(undefined);
  assert.equal(cost.isEmpty(), true);
  assert.equal(cost.getManaValue(), 0);
});

test('Cost.from() preserves mana cost', () => {
  const plain: PlainCost = { mana: parseManaCost('{2}{W}{W}') };
  const cost = Cost.from(plain);
  assert.equal(cost.getManaValue(), 4);
  const display = cost.getDisplayMana();
  assert.equal(display.generic, 2);
  assert.equal(display.W, 2);
});

test('Cost.from() preserves tap flag', () => {
  const cost = Cost.from({ tap: true });
  assert.equal(cost.requiresTap(), true);
});

test('Cost.from() does not mutate the original plain cost', () => {
  const mana = parseManaCost('{3}');
  const plain: PlainCost = { mana };
  const cost = Cost.from(plain);
  cost.addManaTax({ generic: 2 });
  assert.equal(mana.generic, 3, 'original ManaCost should be unchanged');
  assert.equal(cost.getDisplayMana().generic, 5);
});

// =============================================================================
// Mana mutations
// =============================================================================

test('addManaTax increases the mana cost', () => {
  const cost = Cost.from({ mana: parseManaCost('{1}{R}') });
  cost.addManaTax({ generic: 2 });
  assert.equal(cost.getDisplayMana().generic, 3);
  assert.equal(cost.getDisplayMana().R, 1);
  assert.equal(cost.getManaValue(), 4); // 3 generic + 1 R
});

test('addManaTax creates mana on an empty cost', () => {
  const cost = Cost.empty();
  cost.addManaTax({ W: 1 });
  assert.equal(cost.getManaValue(), 1);
  assert.equal(cost.getDisplayMana().W, 1);
});

test('addManaTax with negative delta reduces cost (cost-modification convention)', () => {
  const cost = Cost.from({ mana: parseManaCost('{3}{U}') });
  cost.addManaTax({ generic: -1 });
  assert.equal(cost.getDisplayMana().generic, 2);
});

test('addManaTax does not reduce below zero', () => {
  const cost = Cost.from({ mana: parseManaCost('{1}') });
  cost.addManaTax({ generic: -5 });
  assert.equal(cost.getDisplayMana().generic, 0);
});

test('applyReduction reduces the mana cost', () => {
  const cost = Cost.from({ mana: parseManaCost('{4}{G}') });
  cost.applyReduction({ generic: 2 });
  assert.equal(cost.getDisplayMana().generic, 2);
  assert.equal(cost.getDisplayMana().G, 1);
});

test('applyReduction does not reduce below zero', () => {
  const cost = Cost.from({ mana: parseManaCost('{1}') });
  cost.applyReduction({ generic: 5 });
  assert.equal(cost.getDisplayMana().generic, 0);
});

test('applyReduction is a no-op on costless abilities', () => {
  const cost = Cost.from({ tap: true });
  cost.applyReduction({ generic: 2 });
  assert.equal(cost.getManaValue(), 0);
});

test('applyReductionBudget lets unused colored reduction spill into generic mana', () => {
  const cost = Cost.from({ mana: parseManaCost('{5}{W}') });
  cost.applyReductionBudget(
    { W: 1, U: 1, B: 1, R: 1, G: 1 },
    { spillUnusedColoredToGeneric: true },
  );

  const display = cost.getDisplayMana();
  assert.equal(display.W, 0);
  assert.equal(display.generic, 1);
});

test('applyReductionBudget handles hybrid, two-or-color hybrid, and phyrexian symbols', () => {
  const cost = Cost.from({ mana: parseManaCost('{G/U}{2/U}{U/P}') });
  cost.applyReductionBudget(
    { W: 1, U: 1, B: 1, R: 1, G: 1 },
    { spillUnusedColoredToGeneric: true },
  );

  const display = cost.getDisplayMana();
  assert.equal(display.generic, 0);
  assert.equal((display.hybrid ?? []).length, 0);
  assert.equal((display.phyrexian ?? []).length, 0);
  assert.equal(cost.getManaValue(), 0);
});

test('resolveX converts X to generic', () => {
  const cost = Cost.from({ mana: parseManaCost('{X}{X}{1}') });
  assert.equal(cost.getDisplayMana().X, 2);
  cost.resolveX(3);
  assert.equal(cost.getDisplayMana().X, 0);
  assert.equal(cost.getDisplayMana().generic, 7); // 1 + 3*2
});

test('resolveX is a no-op when no X', () => {
  const cost = Cost.from({ mana: parseManaCost('{3}') });
  cost.resolveX(5);
  assert.equal(cost.getDisplayMana().generic, 3);
});

// =============================================================================
// combineWith / addManaCostFrom / merge
// =============================================================================

test('combineWith adds mana costs together', () => {
  const left = Cost.from({ mana: parseManaCost('{1}{W}') });
  const right = Cost.from({ mana: parseManaCost('{2}{U}') });
  const combined = left.combineWith(right);
  assert.equal(combined.getDisplayMana().generic, 3);
  assert.equal(combined.getDisplayMana().W, 1);
  assert.equal(combined.getDisplayMana().U, 1);
});

test('combineWith merges tap flags', () => {
  const left = Cost.from({ tap: true });
  const right = Cost.from({ mana: parseManaCost('{1}') });
  const combined = left.combineWith(right);
  assert.equal(combined.requiresTap(), true);
  assert.equal(combined.getManaValue(), 1);
});

test('combineWith does not mutate the original costs', () => {
  const left = Cost.from({ mana: parseManaCost('{1}') });
  const right = Cost.from({ mana: parseManaCost('{2}') });
  left.combineWith(right);
  assert.equal(left.getManaValue(), 1, 'left should be unchanged');
  assert.equal(right.getManaValue(), 2, 'right should be unchanged');
});

test('addManaCostFrom mutates in place', () => {
  const base = Cost.from({ mana: parseManaCost('{1}') });
  const extra = Cost.from({ mana: parseManaCost('{R}') });
  base.addManaCostFrom(extra);
  assert.equal(base.getManaValue(), 2);
  assert.equal(base.getDisplayMana().R, 1);
});

test('Cost.merge uses override mana instead of adding', () => {
  const base = Cost.from({ mana: parseManaCost('{5}') });
  const override = Cost.from({ mana: parseManaCost('{1}{B}') });
  const merged = Cost.merge(base, override);
  assert.equal(merged.getDisplayMana().generic, 1);
  assert.equal(merged.getDisplayMana().B, 1);
  assert.equal(merged.getManaValue(), 2, 'override replaces, does not add');
});

test('Cost.merge preserves base mana when override has none', () => {
  const base = Cost.from({ mana: parseManaCost('{3}') });
  const override = Cost.from({ tap: true });
  const merged = Cost.merge(base, override);
  assert.equal(merged.getManaValue(), 3);
  assert.equal(merged.requiresTap(), true);
});

// =============================================================================
// clone / toPlainCost
// =============================================================================

test('clone creates an independent copy', () => {
  const original = Cost.from({ mana: parseManaCost('{2}{R}'), tap: true, delve: true });
  const copy = original.clone();
  copy.addManaTax({ generic: 5 });
  assert.equal(original.getManaValue(), 3, 'original should be unchanged');
  assert.equal(copy.getManaValue(), 8);
});

test('toPlainCost round-trips correctly', () => {
  const plain: PlainCost = {
    mana: parseManaCost('{2}{B}{B}'),
    tap: true,
    sacrifice: { self: true },
    payLife: 2,
  };
  const cost = Cost.from(plain);
  const roundTripped = cost.toPlainCost();
  assert.equal(roundTripped.mana!.generic, 2);
  assert.equal(roundTripped.mana!.B, 2);
  assert.equal(roundTripped.tap, true);
  assert.equal(roundTripped.sacrifice!.self, true);
  assert.equal(roundTripped.payLife, 2);
});

// =============================================================================
// Query methods
// =============================================================================

test('getManaValue returns total mana', () => {
  assert.equal(Cost.from({ mana: parseManaCost('{3}{W}{U}') }).getManaValue(), 5);
  assert.equal(Cost.from({ mana: parseManaCost('{0}') }).getManaValue(), 0);
  assert.equal(Cost.empty().getManaValue(), 0);
});

test('isEmpty returns true only when no cost components exist', () => {
  assert.equal(Cost.empty().isEmpty(), true);
  assert.equal(Cost.from({ tap: true }).isEmpty(), false);
  assert.equal(Cost.from({ mana: parseManaCost('{1}') }).isEmpty(), false);
  assert.equal(Cost.from({ payLife: 2 }).isEmpty(), false);
  assert.equal(Cost.from({ sacrifice: { self: true } }).isEmpty(), false);
  assert.equal(Cost.from({ discard: 1 }).isEmpty(), false);
});

test('getManaCostSnapshot returns a copy that does not affect the original', () => {
  const cost = Cost.from({ mana: parseManaCost('{3}') });
  const snapshot = cost.getManaCostSnapshot()!;
  snapshot.generic = 99;
  assert.equal(cost.getDisplayMana().generic, 3);
});

test('withReducedGeneric returns adjusted ManaCost without mutating', () => {
  const cost = Cost.from({ mana: parseManaCost('{5}{R}') });
  const reduced = cost.withReducedGeneric(3);
  assert.equal(reduced.generic, 2);
  assert.equal(reduced.R, 1);
  assert.equal(cost.getDisplayMana().generic, 5, 'original unchanged');
});

test('withReducedGeneric floors at zero', () => {
  const cost = Cost.from({ mana: parseManaCost('{2}') });
  const reduced = cost.withReducedGeneric(10);
  assert.equal(reduced.generic, 0);
});
