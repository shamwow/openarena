import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { CycleOfRenewal } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeLand(name: string, subtype: string, isBasic = false) {
  const builder = CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype);

  if (isBasic) {
    builder.supertypes('Basic');
  }

  return builder.build();
}

test('Cycle of Renewal sacrifices a land and puts up to two basic lands onto the battlefield tapped', async () => {
  const sacrificialLand = makeLand('Renewal Grove', 'Forest');
  const basicForest = makeLand('Renewal Forest', 'Forest', true);
  const basicMountain = makeLand('Renewal Mountain', 'Mountain', true);
  const nonBasicLand = makeLand('Renewal Outpost', 'Desert');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Renewal Commander', '{G}'),
        cards: [CycleOfRenewal, sacrificialLand, basicForest, basicMountain, nonBasicLand],
        playerName: 'Renewal',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cycle of Renewal' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Renewal Grove' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 1);
  engine.addMana('player1', 'C', 2);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Cycle of Renewal').objectId,
  });
  await settleEngine();

  const basicForestState = getCard(state, 'player1', Zone.BATTLEFIELD, 'Renewal Forest');
  const basicMountainState = getCard(state, 'player1', Zone.BATTLEFIELD, 'Renewal Mountain');

  assert.equal(graveyardNames(state, 'player1').includes('Cycle of Renewal'), true);
  assert.equal(graveyardNames(state, 'player1').includes('Renewal Grove'), true);
  assert.equal(basicForestState.tapped, true);
  assert.equal(basicMountainState.tapped, true);
  assert.equal(state.zones.player1.LIBRARY.some((card) => card.definition.name === 'Renewal Outpost'), true);
  assert.equal(
    state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Renewal Outpost'),
    false,
  );
});

test('Cycle of Renewal does not require a land to be sacrificed in order to be cast', async () => {
  const basicForest = makeLand('Lone Forest', 'Forest', true);
  const basicMountain = makeLand('Lone Mountain', 'Mountain', true);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Renewal Commander', '{G}'),
        cards: [CycleOfRenewal, basicForest, basicMountain],
        playerName: 'Renewal',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cycle of Renewal' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 1);
  engine.addMana('player1', 'C', 2);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Cycle of Renewal').objectId,
  });
  await settleEngine();

  assert.equal(graveyardNames(state, 'player1').includes('Cycle of Renewal'), true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Lone Forest').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Lone Mountain').tapped, true);
});
