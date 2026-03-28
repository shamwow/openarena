import assert from 'node:assert/strict';
import test from 'node:test';

import { FreedomFighterRecruit } from '../../../src/cards/sets/starter/creatures.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, makeCommander, settleEngine } from './helpers.ts';

test('Freedom Fighter Recruit tracks the number of creatures you control as its power', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Recruit Commander', '{R}'),
        cards: [FreedomFighterRecruit],
        playerName: 'Recruit Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Freedom Fighter Recruit' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Freedom Fighter Recruit' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await settleEngine();

  const recruit = getCard(state, 'player1', Zone.BATTLEFIELD, 'Freedom Fighter Recruit');
  assert.equal(recruit.modifiedPower, 1);
  assert.equal(recruit.modifiedToughness, 2);

  const supportToken = engine.createToken('player1', {
    name: 'Support Token',
    types: [CardType.CREATURE],
    subtypes: ['Ally'],
    power: 1,
    toughness: 1,
    abilities: [],
  });

  await engine.submitAction({
    type: ActionType.PASS_PRIORITY,
    playerId: state.priorityPlayer ?? 'player1',
  });
  await settleEngine();

  assert.equal(
    getCard(state, 'player1', Zone.BATTLEFIELD, 'Freedom Fighter Recruit').modifiedPower,
    2,
  );

  engine.destroyPermanent(supportToken.objectId);
  await engine.submitAction({
    type: ActionType.PASS_PRIORITY,
    playerId: state.priorityPlayer ?? 'player1',
  });
  await settleEngine();

  assert.equal(
    getCard(state, 'player1', Zone.BATTLEFIELD, 'Freedom Fighter Recruit').modifiedPower,
    1,
  );
});
