import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { Gamble } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, GameEventType, Phase, Step, Zone, type CardInstance } from '../../../src/engine/types.ts';
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

function chooseGambleTarget(request: ChoiceRequest): void {
  if (request.type === 'chooseN' && request.prompt.includes('Search your library')) {
    const target = (request.options as CardInstance[]).find((card) => card.definition.name === 'Jackpot');
    assert.ok(target, 'Expected Jackpot to be a searchable Gamble target.');
    request.resolve([target]);
    return;
  }

  if (request.type === 'chooseYesNo') {
    request.resolve(true);
    return;
  }

  if (request.type === 'chooseOne' || request.type === 'choosePlayer') {
    request.resolve(request.options[0]);
    return;
  }

  if (request.type === 'chooseUpToN') {
    request.resolve(request.options.slice(0, request.count ?? 0));
    return;
  }

  if (request.type === 'orderObjects') {
    request.resolve(request.options);
    return;
  }

  request.resolve(request.options);
}

test('Gamble can discard the tutored card at random and records a discard event', async () => {
  const spareCard = makeFillerCard('Spare Card');
  const jackpot = makeFillerCard('Jackpot');
  const libraryFiller = makeFillerCard('Library Filler');
  const originalRandom = Math.random;

  Math.random = () => 0.99;

  try {
    const { state, engine } = createHarness({
      decks: [
        {
          commander: makeCommander('Gamble Commander', '{R}'),
          cards: [Gamble, spareCard, jackpot, libraryFiller],
          playerName: 'Gambler',
        },
        { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
        { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Gamble' }, Zone.HAND)
          .moveCard({ playerId: 'player1', name: 'Spare Card' }, Zone.HAND)
          .moveCard({ playerId: 'player1', name: 'Jackpot' }, Zone.LIBRARY, { position: 'top' })
          .moveCard({ playerId: 'player1', name: 'Library Filler' }, Zone.LIBRARY, { position: 'bottom' })
          .setTurn({
            activePlayer: 'player1',
            currentPhase: Phase.PRECOMBAT_MAIN,
            currentStep: Step.MAIN,
            priorityPlayer: 'player1',
            passedPriority: [],
          });
      },
      choiceResponder: chooseGambleTarget,
    });

    engine.addMana('player1', 'R', 1);

    await engine.submitAction({
      type: ActionType.CAST_SPELL,
      playerId: 'player1',
      cardId: getCard(state, 'player1', Zone.HAND, 'Gamble').objectId,
    });
    await settleEngine();

    assert.deepEqual(handNames(state, 'player1'), ['Spare Card']);
    assert.deepEqual(
      graveyardNames(state, 'player1').sort(),
      ['Gamble', 'Jackpot'].sort(),
    );
    assert.equal(
      state.eventLog.some((event) => event.type === GameEventType.DISCARDED && event.objectId === getCard(state, 'player1', Zone.GRAVEYARD, 'Jackpot').objectId),
      true,
    );
    assert.equal(
      state.zones.player1.LIBRARY.some((card) => card.definition.name === 'Jackpot'),
      false,
    );
  } finally {
    Math.random = originalRandom;
  }
});
