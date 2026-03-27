import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { EarthbenderAscension } from '../../../src/cards/sets/starter/enchantments.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Keyword, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, makeCommander, settleEngine } from './helpers.ts';

function makeLand(name: string, subtype: string, isBasic = false) {
  const builder = CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype);

  if (isBasic) {
    builder.supertypes('Basic');
  }

  return builder.build();
}

function makeCreature(name: string) {
  return CardBuilder.create(name)
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

test('Earthbender Ascension earthbends an existing land first, then fetches a tapped basic that is not earthbended', async () => {
  const battlefieldLand = makeLand('Training Grounds', 'Forest');
  const fetchedBasic = makeLand('Ascension Forest', 'Forest', true);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Ascension Commander', '{G}'),
        cards: [EarthbenderAscension, battlefieldLand, fetchedBasic],
        playerName: 'Ascension Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earthbender Ascension' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Training Grounds' }, Zone.BATTLEFIELD)
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
  engine.addMana('player1', 'C', 2);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Earthbender Ascension').objectId,
  });
  await settleEngine();

  const ascension = getCard(state, 'player1', Zone.BATTLEFIELD, 'Earthbender Ascension');
  const earthbendedLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Training Grounds');
  const searchedLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Ascension Forest');

  assert.equal(ascension.counters.quest, 1);
  assert.equal(earthbendedLand.counters['+1/+1'], 2);
  assert.equal(earthbendedLand.modifiedPower, 2);
  assert.equal(earthbendedLand.modifiedToughness, 2);
  assert.equal(hasType(earthbendedLand, CardType.CREATURE), true);
  assert.equal((earthbendedLand.modifiedKeywords ?? []).includes(Keyword.HASTE), true);

  assert.equal(searchedLand.tapped, true);
  assert.equal(searchedLand.counters['+1/+1'] ?? 0, 0);
  assert.equal(hasType(searchedLand, CardType.CREATURE), false);
});

test('Earthbender Ascension keeps quest counters at four and rewards the landfall with a counter and trample', async () => {
  const landToPlay = makeLand('Landfall Forest', 'Forest', true);
  const targetCreature = makeCreature('Tunnel Fighter');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Ascension Commander', '{G}'),
        cards: [EarthbenderAscension, landToPlay, targetCreature],
        playerName: 'Ascension Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earthbender Ascension' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Earthbender Ascension' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Tunnel Fighter' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Tunnel Fighter' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Landfall Forest' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const ascensionId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Earthbender Ascension').objectId;
  engine.addCounters(ascensionId, 'quest', 3, { player: 'player1' });

  await engine.submitAction({
    type: ActionType.PLAY_LAND,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Landfall Forest').objectId,
  });
  await settleEngine();

  const ascension = getCard(state, 'player1', Zone.BATTLEFIELD, 'Earthbender Ascension');
  const creature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Tunnel Fighter');

  assert.equal(ascension.counters.quest, 4);
  assert.equal(creature.counters['+1/+1'], 1);
  assert.equal(creature.modifiedPower, 3);
  assert.equal(creature.modifiedToughness, 3);
  assert.equal((creature.modifiedKeywords ?? []).includes(Keyword.TRAMPLE), true);
});
