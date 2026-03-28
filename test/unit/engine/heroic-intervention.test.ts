import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { HeroicIntervention } from '../../../src/cards/sets/starter/spells.ts';
import { Forest } from '../../../src/cards/sets/starter/lands.ts';
import { hasAbilityDescription } from '../../../src/engine/AbilityPrimitives.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, handNames, makeCommander, makeTargetedCreatureRemoval, settleEngine, battlefieldNames, graveyardNames } from './helpers.ts';

function makeCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

test('Heroic Intervention grants hexproof and indestructible, and stops opposing removal', async () => {
  const shieldedCreature = makeCreature('Shielded Bear', 2, 2);
  const removal = makeTargetedCreatureRemoval('Banishing Ray', '{W}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Intervention Commander', '{G}'),
        cards: [HeroicIntervention, shieldedCreature, Forest],
        playerName: 'Intervention Player',
      },
      {
        commander: makeCommander('Removal Commander', '{W}'),
        cards: [removal],
        playerName: 'Removal Player',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Heroic Intervention' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Shielded Bear' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Banishing Ray' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 2);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Heroic Intervention').objectId,
  });
  await settleEngine();

  const shieldedBear = getCard(state, 'player1', Zone.BATTLEFIELD, 'Shielded Bear');
  const forest = getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest');
  assert.ok(hasAbilityDescription(shieldedBear, 'Hexproof'));
  assert.ok(hasAbilityDescription(shieldedBear, 'Indestructible'));
  assert.ok(hasAbilityDescription(forest, 'Hexproof'));
  assert.ok(hasAbilityDescription(forest, 'Indestructible'));
  assert.ok(graveyardNames(state, 'player1').includes('Heroic Intervention'));

  state.priorityPlayer = 'player2';
  engine.addMana('player2', 'W', 1);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player2',
    cardId: getCard(state, 'player2', Zone.HAND, 'Banishing Ray').objectId,
    targets: [shieldedBear.objectId],
  });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player2'), ['Banishing Ray']);
  assert.deepEqual(battlefieldNames(state, 'player1').sort(), ['Forest', 'Shielded Bear'].sort());

  engine.destroyPermanent(shieldedBear.objectId);
  engine.destroyPermanent(forest.objectId);
  await settleEngine();

  assert.deepEqual(battlefieldNames(state, 'player1').sort(), ['Forest', 'Shielded Bear'].sort());
});

test('Heroic Intervention granted abilities fall off after cleanup', async () => {
  const shieldedCreature = makeCreature('Cleanup Bear', 2, 2);
  const removal = makeTargetedCreatureRemoval('Pinning Light', '{W}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Cleanup Commander', '{G}'),
        cards: [HeroicIntervention, shieldedCreature],
        playerName: 'Cleanup Player',
      },
      {
        commander: makeCommander('P2 Commander', '{W}'),
        cards: [removal],
        playerName: 'P2',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Heroic Intervention' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Cleanup Bear' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Pinning Light' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 2);
  engine.addMana('player2', 'W', 1);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Heroic Intervention').objectId,
  });
  await settleEngine();

  engine.endTurn();
  state.priorityPlayer = 'player1';
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await settleEngine();

  const afterCleanupBear = getCard(state, 'player1', Zone.BATTLEFIELD, 'Cleanup Bear');
  assert.ok(!hasAbilityDescription(afterCleanupBear, 'Hexproof'));
  assert.ok(!hasAbilityDescription(afterCleanupBear, 'Indestructible'));
});
