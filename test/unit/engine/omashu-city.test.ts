import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { Mountain, OmashuCity } from '../../../src/cards/sets/starter/lands.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, handNames, makeCommander, settleEngine } from './helpers.ts';

function makeOneManaSpell(name: string) {
  return CardBuilder.create(name)
    .cost('{1}')
    .types(CardType.SORCERY)
    .spellEffect(() => {})
    .build();
}

test('Omashu City enters tapped when played from hand', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Omashu Commander', '{2}{R}{G}'),
        cards: [OmashuCity, makeOneManaSpell('Red Follow-Up')],
        playerName: 'Omashu Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Omashu City' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const omashuId = getCard(state, 'player1', Zone.HAND, 'Omashu City').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.PLAY_LAND && action.cardId === omashuId,
    ),
  );
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Omashu City').tapped, true);
});

test('Omashu City can tap for red mana', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Omashu Commander', '{2}{R}{G}'),
        cards: [OmashuCity, makeOneManaSpell('Red Follow-Up')],
        playerName: 'Omashu Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    choiceResponder: (request) => {
      if (request.type === 'chooseOne' && request.prompt.includes('Choose a color of mana to add')) {
        assert.deepEqual(request.options, ['R', 'G']);
        request.resolve('R');
        return;
      }
      throw new Error(`Unexpected choice request: ${request.type}`);
    },
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Omashu City' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Red Follow-Up' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const omashuId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Omashu City').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === omashuId &&
        action.abilityIndex === 0,
    ),
  );
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Omashu City').tapped, true);
  assert.equal(state.players.player1.manaPool.R, 1);
});

test('Omashu City can tap for green mana', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Omashu Commander', '{2}{R}{G}'),
        cards: [OmashuCity, makeOneManaSpell('Green Follow-Up')],
        playerName: 'Omashu Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    choiceResponder: (request) => {
      if (request.type === 'chooseOne' && request.prompt.includes('Choose a color of mana to add')) {
        assert.deepEqual(request.options, ['R', 'G']);
        request.resolve('G');
        return;
      }
      throw new Error(`Unexpected choice request: ${request.type}`);
    },
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Omashu City' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Green Follow-Up' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const omashuId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Omashu City').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === omashuId &&
        action.abilityIndex === 0,
    ),
  );
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Omashu City').tapped, true);
  assert.equal(state.players.player1.manaPool.G, 1);
});

test('Omashu City can sacrifice itself to draw a card', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Omashu Commander', '{2}{R}{G}'),
        cards: [Mountain, OmashuCity],
        playerName: 'Omashu Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Omashu City' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Mountain' }, Zone.LIBRARY, { position: 'end' })
        .setPlayer('player1', { manaPool: { C: 4 } })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const omashuId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Omashu City').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === omashuId &&
        action.abilityIndex === 1,
    ),
  );
  await settleEngine();

  assert.equal(handNames(state, 'player1').includes('Mountain'), true);
  assert.equal(graveyardNames(state, 'player1').includes('Omashu City'), true);
});
