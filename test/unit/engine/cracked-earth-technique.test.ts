import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { CrackedEarthTechnique } from '../../../src/cards/sets/starter/spells.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import { createHarness, getCard, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeLand(name: string, subtype: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype)
    .build();
}

function chooseCrackedFieldA(request: ChoiceRequest): void {
  if (request.type === 'chooseOne') {
    const picked = request.options.find(
      (option) => typeof option === 'object' && option !== null && 'definition' in option && option.definition.name === 'Cracked Field A',
    );
    request.resolve(picked ?? request.options[0]);
    return;
  }

  if (request.type === 'chooseYesNo') {
    request.resolve(true);
    return;
  }

  if (request.type === 'chooseN' || request.type === 'chooseUpToN') {
    request.resolve(request.options.slice(0, request.count ?? 0));
    return;
  }

  if (request.type === 'choosePlayer' || request.type === 'orderObjects') {
    request.resolve(request.options);
    return;
  }

  request.resolve(request.options);
}

test('Cracked Earth Technique earthbends twice, can reuse the same land, and gains life', async () => {
  const crackedFieldA = makeLand('Cracked Field A', 'Forest');
  const crackedFieldB = makeLand('Cracked Field B', 'Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Earth Commander', '{G}'),
        cards: [CrackedEarthTechnique, crackedFieldA, crackedFieldB],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    choiceResponder: chooseCrackedFieldA,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cracked Earth Technique' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Cracked Field A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Cracked Field B' }, Zone.BATTLEFIELD)
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
  engine.addMana('player1', 'C', 4);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Cracked Earth Technique').objectId,
  });
  await settleEngine();

  const crackedFieldAState = getCard(state, 'player1', Zone.BATTLEFIELD, 'Cracked Field A');
  const crackedFieldBState = getCard(state, 'player1', Zone.BATTLEFIELD, 'Cracked Field B');

  assert.equal(state.players.player1.life, 43);
  assert.equal(graveyardNames(state, 'player1').includes('Cracked Earth Technique'), true);
  assert.equal(hasType(crackedFieldAState, CardType.CREATURE), true);
  assert.equal(crackedFieldAState.counters['+1/+1'], 6);
  assert.equal(crackedFieldAState.modifiedPower, 6);
  assert.equal(crackedFieldAState.modifiedToughness, 6);
  assert.equal(hasType(crackedFieldBState, CardType.CREATURE), false);
  assert.equal(crackedFieldBState.counters['+1/+1'], undefined);
});
