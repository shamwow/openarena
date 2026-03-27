import assert from 'node:assert/strict';
import test from 'node:test';

import { ManyPartings } from '../../../src/cards/sets/starter/spells.ts';
import { Forest } from '../../../src/cards/sets/starter/lands.ts';
import { ActionType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { battlefieldNames, createHarness, getCard, handNames, makeCommander, settleEngine } from './helpers.ts';

test('Many Partings searches a basic land and does not create Food without a commander on the battlefield', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Many Partings Commander', '{G}'),
        cards: [ManyPartings, Forest],
        playerName: 'Partings Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Many Partings' }, Zone.HAND)
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
    cardId: getCard(state, 'player1', Zone.HAND, 'Many Partings').objectId,
  });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player1').sort(), ['Forest']);
  assert.ok(!battlefieldNames(state, 'player1').includes('Food'));
});

test('Many Partings creates Food when you control a commander on the battlefield', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Many Partings Commander', '{G}'),
        cards: [ManyPartings, Forest],
        playerName: 'Partings Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Many Partings' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Many Partings Commander' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Many Partings Commander' }, { summoningSick: false })
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
    cardId: getCard(state, 'player1', Zone.HAND, 'Many Partings').objectId,
  });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player1').sort(), ['Forest']);
  assert.ok(battlefieldNames(state, 'player1').includes('Food'));
  assert.ok(battlefieldNames(state, 'player1').includes('Many Partings Commander'));
});
