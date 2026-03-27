import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { BumisFeastLecture } from '../../../src/cards/sets/starter/spells.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, makeCommander } from './helpers.ts';

function makeBasicLand(name: string, subtype: string, color: 'W' | 'U' | 'B' | 'R' | 'G') {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype)
    .tapForMana(color)
    .build();
}

test("Bumi's Feast Lecture creates Food first and earthbends for twice the Food count", async () => {
  const practiceField = makeBasicLand('Practice Field', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{G}'),
        cards: [BumisFeastLecture, practiceField],
        playerName: 'Bumi',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: "Bumi's Feast Lecture" }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Practice Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Practice Field' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.createPredefinedToken('player1', 'Food');
  assert.equal(state.zones.player1.BATTLEFIELD.filter((card) => card.definition.subtypes.includes('Food')).length, 1);

  engine.addMana('player1', 'G', 1);
  engine.addMana('player1', 'C', 1);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, "Bumi's Feast Lecture").objectId,
  });

  const foodCount = state.zones.player1.BATTLEFIELD.filter((card) => card.definition.subtypes.includes('Food')).length;
  assert.equal(foodCount, 2);

  const land = getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Field');
  assert.equal(hasType(land, CardType.LAND), true);
  assert.equal(hasType(land, CardType.CREATURE), true);
  assert.equal(land.counters['+1/+1'], 4);
  assert.equal(land.modifiedPower, 4);
  assert.equal(land.modifiedToughness, 4);
  assert.equal((land.modifiedKeywords ?? []).includes('Haste'), true);
});
