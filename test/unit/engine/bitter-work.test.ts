import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { BitterWork } from '../../../src/cards/sets/starter/spells.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, handNames, makeCommander, settleEngine } from './helpers.ts';

function makeCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeLand(name: string, subtype: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype)
    .build();
}

test('Bitter Work draws once per attacked player with one or more qualifying attackers', async () => {
  const heavyA = makeCreature('Heavy A', 4, 4);
  const heavyB = makeCreature('Heavy B', 5, 5);
  const heavyC = makeCreature('Heavy C', 4, 3);
  const fillerA = makeCreature('Draw Filler A', 1, 1);
  const fillerB = makeCreature('Draw Filler B', 1, 1);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Gruul Commander', '{R}{G}'),
        cards: [BitterWork, heavyA, heavyB, heavyC, fillerA, fillerB],
        playerName: 'Gruul',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bitter Work' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Heavy A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Heavy B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Heavy C' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Heavy A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Heavy B' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Heavy C' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map(),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const heavyAId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Heavy A').objectId;
  const heavyBId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Heavy B').objectId;
  const heavyCId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Heavy C').objectId;

  await engine.submitAction({
    type: ActionType.DECLARE_ATTACKERS,
    playerId: 'player1',
    attackers: [
      { attackerId: heavyAId, defendingPlayer: 'player2' },
      { attackerId: heavyBId, defendingPlayer: 'player2' },
      { attackerId: heavyCId, defendingPlayer: 'player3' },
    ],
  });
  await settleEngine();

  const drawEvents = state.eventLog.filter((event) => event.type === 'DREW_CARD' && event.player === 'player1');
  assert.equal(drawEvents.length, 2);
  assert.equal(handNames(state, 'player1').length, 2);
});

test('Bitter Work exhaust ability can be activated during your turn and only once per permanent', async () => {
  const earthLand = makeLand('Earth Practice', 'Forest');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Earth Commander', '{R}{G}'),
        cards: [BitterWork, earthLand],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bitter Work' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Earth Practice' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Earth Practice' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.BEGINNING_OF_COMBAT,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 4);

  const bitterWorkId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bitter Work').objectId;
  const earthLandId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Earth Practice').objectId;

  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === bitterWorkId,
    ),
    targets: [earthLandId],
  });
  await settleEngine();

  const animatedLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Earth Practice');
  assert.equal(hasType(animatedLand, CardType.CREATURE), true);
  assert.equal(animatedLand.counters['+1/+1'], 4);
  assert.equal(animatedLand.modifiedPower, 4);
  assert.equal(animatedLand.modifiedToughness, 4);

  engine.addMana('player1', 'G', 4);

  assert.equal(
    engine.getLegalActions('player1').some(
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === bitterWorkId,
    ),
    false,
  );
});

test('Bitter Work exhaust ability is not legal during another player turn', () => {
  const earthLand = makeLand('Offturn Practice', 'Forest');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Earth Commander', '{R}{G}'),
        cards: [BitterWork, earthLand],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bitter Work' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Offturn Practice' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Offturn Practice' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const bitterWorkId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bitter Work').objectId;
  engine.addMana('player1', 'G', 4);

  assert.equal(
    engine.getLegalActions('player1').some(
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === bitterWorkId,
    ),
    false,
  );
});
