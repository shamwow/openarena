import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { HogMonkeyRampage } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

test('Hog-Monkey Rampage can be cast with green mana and buffs a 4-power creature before fight', async () => {
  const yourCreature = makeCreature('Rampage Ally', 4, 5);
  const opposingCreature = makeCreature('Rampage Enemy', 2, 6);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Rampage Commander', '{G}'),
        cards: [HogMonkeyRampage, yourCreature],
        playerName: 'Rampage',
      },
      {
        commander: makeCommander('P2 Commander', '{2}'),
        cards: [opposingCreature],
        playerName: 'P2',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Hog-Monkey Rampage' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Rampage Ally' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Rampage Enemy' }, Zone.BATTLEFIELD)
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

  const yourCreatureId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Rampage Ally').objectId;
  const opposingCreatureId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Rampage Enemy').objectId;

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Hog-Monkey Rampage').objectId,
    targets: [yourCreatureId, opposingCreatureId],
  });
  await settleEngine();

  const yourCreatureAfter = getCard(state, 'player1', Zone.BATTLEFIELD, 'Rampage Ally');
  const damageToEnemy = state.eventLog.find((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.sourceId === yourCreatureId &&
    event.targetId === opposingCreatureId,
  );
  const damageToAlly = state.eventLog.find((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.sourceId === opposingCreatureId &&
    event.targetId === yourCreatureId,
  );

  assert.equal(yourCreatureAfter.counters['+1/+1'], 1);
  assert.equal(damageToEnemy?.amount, 5);
  assert.equal(damageToAlly?.amount, 2);
  assert.equal(graveyardNames(state, 'player1').includes('Hog-Monkey Rampage'), true);
});

test('Hog-Monkey Rampage can be cast with red mana and does not add a counter below 4 power', async () => {
  const yourCreature = makeCreature('Smaller Ally', 3, 3);
  const opposingCreature = makeCreature('Smaller Enemy', 3, 3);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Rampage Commander', '{R}'),
        cards: [HogMonkeyRampage, yourCreature],
        playerName: 'Rampage',
      },
      {
        commander: makeCommander('P2 Commander', '{2}'),
        cards: [opposingCreature],
        playerName: 'P2',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Hog-Monkey Rampage' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Smaller Ally' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Smaller Enemy' }, Zone.BATTLEFIELD)
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

  const yourCreatureId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Smaller Ally').objectId;
  const opposingCreatureId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Smaller Enemy').objectId;

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Hog-Monkey Rampage').objectId,
    targets: [yourCreatureId, opposingCreatureId],
  });
  await settleEngine();

  const yourCreatureAfter = [...state.zones.player1.BATTLEFIELD, ...state.zones.player1.GRAVEYARD]
    .find((card) => card.definition.name === 'Smaller Ally');
  const damageToEnemy = state.eventLog.find((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.sourceId === yourCreatureId &&
    event.targetId === opposingCreatureId,
  );
  const damageToAlly = state.eventLog.find((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.sourceId === opposingCreatureId &&
    event.targetId === yourCreatureId,
  );

  assert.ok(yourCreatureAfter);
  assert.equal(yourCreatureAfter.counters['+1/+1'] ?? 0, 0);
  assert.equal(damageToEnemy?.amount, 3);
  assert.equal(damageToAlly?.amount, 3);
  assert.equal(graveyardNames(state, 'player1').includes('Hog-Monkey Rampage'), true);
});
