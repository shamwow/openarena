import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { Explore } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import {
  createHarness,
  getCard,
  handNames,
  makeCommander,
  settleEngine,
} from './helpers.ts';

function makeLand(name: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .build();
}

test('Explore grants an additional land play after you already played a land and draws a card', async () => {
  const firstLand = makeLand('First Forest');
  const secondLand = makeLand('Second Forest');
  const libraryCard = makeLand('Library Forest');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Explore Commander', '{G}'),
        cards: [Explore, firstLand, secondLand, libraryCard],
        playerName: 'Explorer',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Explore' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'First Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Second Forest' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Library Forest' }, Zone.LIBRARY, { position: 'top' })
        .setPlayer('player1', {
          hasPlayedLand: true,
          landsPlayedThisTurn: 1,
          landPlaysAvailable: 1,
        })
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
  engine.addMana('player1', 'C', 1);

  assert.equal(
    engine.getLegalActions('player1').some(
      (action) =>
        action.type === ActionType.PLAY_LAND &&
        action.cardId === getCard(state, 'player1', Zone.HAND, 'Second Forest').objectId,
    ),
    false,
  );

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Explore').objectId,
  });
  await settleEngine();

  assert.equal(state.players.player1.landPlaysAvailable, 2);
  assert.deepEqual(
    handNames(state, 'player1').sort(),
    ['Library Forest', 'Second Forest'].sort(),
  );

  assert.equal(
    engine.getLegalActions('player1').some(
      (action) =>
        action.type === ActionType.PLAY_LAND &&
        action.cardId === getCard(state, 'player1', Zone.HAND, 'Second Forest').objectId,
    ),
    true,
  );

  await engine.submitAction({
    type: ActionType.PLAY_LAND,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Second Forest').objectId,
  });
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Second Forest').zone, Zone.BATTLEFIELD);
});

test('Explore lets you play two lands in the same turn when cast before any land plays', async () => {
  const manaLandA = makeLand('Mana Forest A');
  const manaLandB = makeLand('Mana Forest B');
  const firstLand = makeLand('First New Forest');
  const secondLand = makeLand('Second New Forest');
  const libraryCard = makeLand('Explore Draw');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Explore Commander', '{G}'),
        cards: [Explore, manaLandA, manaLandB, firstLand, secondLand, libraryCard],
        playerName: 'Explorer',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Explore' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Mana Forest A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Mana Forest B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'First New Forest' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Second New Forest' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Explore Draw' }, Zone.LIBRARY, { position: 'top' })
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
  engine.addMana('player1', 'C', 1);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Explore').objectId,
  });
  await settleEngine();

  assert.deepEqual(
    handNames(state, 'player1').sort(),
    ['Explore Draw', 'First New Forest', 'Second New Forest'].sort(),
  );

  await engine.submitAction({
    type: ActionType.PLAY_LAND,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'First New Forest').objectId,
  });
  await settleEngine();

  assert.equal(
    engine.getLegalActions('player1').some(
      (action) =>
        action.type === ActionType.PLAY_LAND &&
        action.cardId === getCard(state, 'player1', Zone.HAND, 'Second New Forest').objectId,
    ),
    true,
  );

  await engine.submitAction({
    type: ActionType.PLAY_LAND,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Second New Forest').objectId,
  });
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'First New Forest').zone, Zone.BATTLEFIELD);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Second New Forest').zone, Zone.BATTLEFIELD);
  assert.equal(state.players.player1.landsPlayedThisTurn, 2);
});
