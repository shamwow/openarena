import assert from 'node:assert/strict';
import test from 'node:test';

import { Forest } from '../../../src/cards/sets/starter/lands.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

test('Forest can be played from hand, enters as a basic land, and taps for green mana', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Forest Commander', '{G}'),
        cards: [Forest],
        playerName: 'Forest Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Forest' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const forestId = getCard(state, 'player1', Zone.HAND, 'Forest').objectId;

  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.PLAY_LAND && action.cardId === forestId,
    ),
  );
  await settleEngine();

  const forestPermanent = getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest');
  assert.equal(forestPermanent.definition.types.includes(CardType.LAND), true);
  assert.equal(forestPermanent.definition.supertypes.includes('Basic'), true);

  const tapAbility = getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === forestPermanent.objectId,
  );
  await engine.submitAction(tapAbility);
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest').tapped, true);
  assert.equal(state.players.player1.manaPool.G, 1);
});
