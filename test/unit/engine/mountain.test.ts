import assert from 'node:assert/strict';
import test from 'node:test';

import { Mountain } from '../../../src/cards/sets/starter/lands.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

test('Mountain can be played from hand, enters as a basic land, and taps for red mana', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Mountain Commander', '{R}'),
        cards: [Mountain],
        playerName: 'Mountain Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Mountain' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const mountainId = getCard(state, 'player1', Zone.HAND, 'Mountain').objectId;

  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.PLAY_LAND && action.cardId === mountainId,
    ),
  );
  await settleEngine();

  const mountainPermanent = getCard(state, 'player1', Zone.BATTLEFIELD, 'Mountain');
  assert.equal(mountainPermanent.definition.types.includes(CardType.LAND), true);
  assert.equal(mountainPermanent.definition.supertypes.includes('Basic'), true);

  const tapAbility = getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === mountainPermanent.objectId,
  );
  await engine.submitAction(tapAbility);
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Mountain').tapped, true);
  assert.equal(state.players.player1.manaPool.R, 1);
});
