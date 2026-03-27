import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { CatharticReunion } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import {
  createHarness,
  getCard,
  graveyardNames,
  handNames,
  makeCommander,
  settleEngine,
} from './helpers.ts';

function makeFillerCard(name: string) {
  return CardBuilder.create(name)
    .types(CardType.SORCERY)
    .build();
}

function defaultChoiceResponder(request: ChoiceRequest): void {
  if (request.type === 'chooseYesNo') {
    request.resolve(true);
    return;
  }

  if (request.type === 'chooseOne' || request.type === 'choosePlayer') {
    request.resolve(request.options[0]);
    return;
  }

  if (request.type === 'chooseN' || request.type === 'chooseUpToN') {
    request.resolve(request.options.slice(0, request.count ?? 0));
    return;
  }

  if (request.type === 'orderObjects') {
    request.resolve(request.options);
    return;
  }

  request.resolve(request.options);
}

test('Cathartic Reunion is not legal to cast without two other cards to discard', () => {
  const spareCard = makeFillerCard('Spare Card');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Red Commander', '{R}'),
        cards: [CatharticReunion, spareCard],
        playerName: 'Red',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cathartic Reunion' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Spare Card' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'C', 1);

  assert.equal(
    engine.getLegalActions('player1').some((action) =>
      action.type === ActionType.CAST_SPELL &&
      action.cardId === getCard(state, 'player1', Zone.HAND, 'Cathartic Reunion').objectId,
    ),
    false,
  );
});

test('Cathartic Reunion discards two other cards and draws three cards', async () => {
  const discardA = makeFillerCard('Discard A');
  const discardB = makeFillerCard('Discard B');
  const drawOne = makeFillerCard('Draw One');
  const drawTwo = makeFillerCard('Draw Two');
  const drawThree = makeFillerCard('Draw Three');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Red Commander', '{R}'),
        cards: [CatharticReunion, discardA, discardB, drawOne, drawTwo, drawThree],
        playerName: 'Red',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cathartic Reunion' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Discard A' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Discard B' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
    choiceResponder: (request) => {
      if (request.type === 'chooseN' && request.prompt.includes('discard')) {
        assert.equal(
          request.options.some((card) => card.definition.name === 'Cathartic Reunion'),
          false,
        );
        request.resolve(request.options.slice(0, request.count ?? 0));
        return;
      }

      defaultChoiceResponder(request);
    },
  });

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'C', 1);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Cathartic Reunion').objectId,
  });
  await settleEngine();

  assert.deepEqual(
    graveyardNames(state, 'player1').sort(),
    ['Cathartic Reunion', 'Discard A', 'Discard B'].sort(),
  );
  assert.equal(handNames(state, 'player1').length, 3);
});
