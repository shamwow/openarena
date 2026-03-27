import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { IrohDemonstration } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, graveyardNames, makeCommander } from './helpers.ts';

function makeCreature(name: string, power = 2, toughness = 2) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeFillers(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => makeCreature(`${prefix} Filler ${index + 1}`, 1, 1));
}

function makeLand(name: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
}

function setMainPhase(builder: Parameters<NonNullable<Parameters<typeof createHarness>[0]>['setup']>[0]) {
  builder.setTurn({
    activePlayer: 'player1',
    currentPhase: Phase.PRECOMBAT_MAIN,
    currentStep: Step.MAIN,
    priorityPlayer: 'player1',
    passedPriority: [],
  });
}

test("Iroh's Demonstration can deal 1 damage to each creature your opponents control", async () => {
  const friendlyCreature = makeCreature('Friendly Body', 2, 3);
  const opponentCreatureA = makeCreature('Opponent Body A', 2, 2);
  const opponentCreatureB = makeCreature('Opponent Body B', 3, 2);
  const followUpLand = makeLand('Follow-Up Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Iroh Commander', '{R}'),
        cards: [IrohDemonstration, friendlyCreature, followUpLand, ...makeFillers('Iroh', 4)],
        playerName: 'Iroh',
      },
      {
        commander: makeCommander('Target Commander One', '{2}'),
        cards: [opponentCreatureA, ...makeFillers('Target One', 4)],
        playerName: 'Target One',
      },
      {
        commander: makeCommander('Target Commander Two', '{2}'),
        cards: [opponentCreatureB, ...makeFillers('Target Two', 4)],
        playerName: 'Target Two',
      },
      { commander: makeCommander('Target Commander Three', '{2}'), cards: makeFillers('Target Three', 4), playerName: 'Target Three' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: "Iroh's Demonstration" }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Friendly Body' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Opponent Body A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player3', name: 'Opponent Body B' }, Zone.BATTLEFIELD);
      setMainPhase(builder);
    },
  });

  engine.addMana('player1', 'R', 2);
  const friendlyId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Friendly Body').objectId;
  const opponentAId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Opponent Body A').objectId;
  const opponentBId = getCard(state, 'player3', Zone.BATTLEFIELD, 'Opponent Body B').objectId;

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, "Iroh's Demonstration").objectId,
    modeChoices: [0],
  });
  const damageEvents = state.eventLog.filter((event) => event.type === 'DAMAGE_DEALT');
  assert.deepEqual(
    damageEvents.map((event) => ({ targetId: event.targetId, amount: event.amount })),
    [
      { targetId: opponentAId, amount: 1 },
      { targetId: opponentBId, amount: 1 },
    ],
  );
  assert.equal(state.zones.player1.BATTLEFIELD.some((card) => card.objectId === friendlyId), true);
  assert.equal(state.zones.player2.BATTLEFIELD.some((card) => card.objectId === opponentAId), true);
  assert.equal(state.zones.player3.BATTLEFIELD.some((card) => card.objectId === opponentBId), true);
  assert.equal(graveyardNames(state, 'player1').includes("Iroh's Demonstration"), true);
});

test("Iroh's Demonstration can deal 4 damage to target creature", async () => {
  const friendlyCreature = makeCreature('Friendly Body', 2, 3);
  const targetCreature = makeCreature('Target Body', 2, 3);
  const followUpLand = makeLand('Follow-Up Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Iroh Commander', '{R}'),
        cards: [IrohDemonstration, friendlyCreature, followUpLand, ...makeFillers('Iroh', 4)],
        playerName: 'Iroh',
      },
      {
        commander: makeCommander('Target Commander', '{2}'),
        cards: [targetCreature, ...makeFillers('Target', 4)],
        playerName: 'Target',
      },
      { commander: makeCommander('Target Commander Two', '{2}'), cards: makeFillers('Target Two', 4), playerName: 'Target Two' },
      { commander: makeCommander('Target Commander Three', '{2}'), cards: makeFillers('Target Three', 4), playerName: 'Target Three' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: "Iroh's Demonstration" }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Friendly Body' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Target Body' }, Zone.BATTLEFIELD);
      setMainPhase(builder);
    },
  });

  engine.addMana('player1', 'R', 2);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, "Iroh's Demonstration").objectId,
    modeChoices: [1],
    targets: [getCard(state, 'player2', Zone.BATTLEFIELD, 'Target Body').objectId],
  });

  assert.equal(graveyardNames(state, 'player2').includes('Target Body'), true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Friendly Body').markedDamage, 0);
  assert.equal(graveyardNames(state, 'player1').includes("Iroh's Demonstration"), true);
});
