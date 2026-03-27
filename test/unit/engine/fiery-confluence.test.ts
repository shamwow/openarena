import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { FieryConfluence } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, graveyardNames, makeCommander } from './helpers.ts';

function makeCreature(name: string, power = 2, toughness = 3) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeArtifact(name: string) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.ARTIFACT)
    .build();
}

function makeMountain(name: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
}

function setMainPhase(builder: Parameters<Exclude<Parameters<typeof createHarness>[0], undefined>['setup']>[0]) {
  builder.setTurn({
    activePlayer: 'player1',
    currentPhase: Phase.PRECOMBAT_MAIN,
    currentStep: Step.MAIN,
    priorityPlayer: 'player1',
    passedPriority: [],
  });
}

test('Fiery Confluence can choose the creature-damage mode three times', async () => {
  const alliedCreature = makeCreature('Allied Body');
  const opposingCreature = makeCreature('Opposing Body');
  const followUpLand = makeMountain('Follow-Up Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Fiery Commander', '{R}'),
        cards: [FieryConfluence, alliedCreature, followUpLand],
        playerName: 'Caster',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [opposingCreature],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fiery Confluence' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Allied Body' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Opposing Body' }, Zone.BATTLEFIELD);
      setMainPhase(builder);
    },
  });

  engine.addMana('player1', 'R', 4);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Fiery Confluence').objectId,
    modeChoices: [0, 0, 0],
  });

  assert.equal(graveyardNames(state, 'player1').includes('Allied Body'), true);
  assert.equal(graveyardNames(state, 'player2').includes('Opposing Body'), true);
  assert.equal(graveyardNames(state, 'player1').includes('Fiery Confluence'), true);
});

test('Fiery Confluence can choose the opponent-damage mode three times', async () => {
  const followUpLand = makeMountain('Follow-Up Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Fiery Commander', '{R}'),
        cards: [FieryConfluence, followUpLand],
        playerName: 'Caster',
      },
      { commander: makeCommander('Target Commander', '{G}'), cards: [], playerName: 'Target' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fiery Confluence' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND);
      setMainPhase(builder);
    },
  });

  engine.addMana('player1', 'R', 4);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Fiery Confluence').objectId,
    modeChoices: [1, 1, 1],
  });

  assert.equal(state.players.player2.life, 34);
  assert.equal(state.players.player3.life, 34);
  assert.equal(state.players.player4.life, 34);
});

test('Fiery Confluence can destroy different artifacts when the same mode is chosen multiple times', async () => {
  const artifactA = makeArtifact('Target Relic A');
  const artifactB = makeArtifact('Target Relic B');
  const artifactC = makeArtifact('Target Relic C');
  const followUpLand = makeMountain('Follow-Up Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Fiery Commander', '{R}'),
        cards: [FieryConfluence, followUpLand],
        playerName: 'Caster',
      },
      {
        commander: makeCommander('Artifact Commander', '{2}'),
        cards: [artifactA, artifactB, artifactC],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fiery Confluence' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Target Relic A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Target Relic B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Target Relic C' }, Zone.BATTLEFIELD);
      setMainPhase(builder);
    },
  });

  engine.addMana('player1', 'R', 4);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Fiery Confluence').objectId,
    modeChoices: [2, 2, 2],
    targets: [
      getCard(state, 'player2', Zone.BATTLEFIELD, 'Target Relic A').objectId,
      getCard(state, 'player2', Zone.BATTLEFIELD, 'Target Relic B').objectId,
      getCard(state, 'player2', Zone.BATTLEFIELD, 'Target Relic C').objectId,
    ],
  });

  assert.equal(graveyardNames(state, 'player2').includes('Target Relic A'), true);
  assert.equal(graveyardNames(state, 'player2').includes('Target Relic B'), true);
  assert.equal(graveyardNames(state, 'player2').includes('Target Relic C'), true);
});

test('Fiery Confluence uses the correct target slice for mixed modal choices', async () => {
  const artifactA = makeArtifact('Mixed Relic A');
  const artifactB = makeArtifact('Mixed Relic B');
  const alliedCreature = makeCreature('Mixed Ally', 2, 2);
  const followUpLand = makeMountain('Follow-Up Mountain');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Fiery Commander', '{R}'),
        cards: [FieryConfluence, alliedCreature, followUpLand],
        playerName: 'Caster',
      },
      {
        commander: makeCommander('Artifact Commander', '{2}'),
        cards: [artifactA, artifactB],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fiery Confluence' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Mixed Ally' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Mixed Relic A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Mixed Relic B' }, Zone.BATTLEFIELD);
      setMainPhase(builder);
    },
  });

  engine.addMana('player1', 'R', 4);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Fiery Confluence').objectId,
    modeChoices: [2, 1, 2],
    targets: [
      getCard(state, 'player2', Zone.BATTLEFIELD, 'Mixed Relic A').objectId,
      getCard(state, 'player2', Zone.BATTLEFIELD, 'Mixed Relic B').objectId,
    ],
  });

  assert.equal(graveyardNames(state, 'player2').includes('Mixed Relic A'), true);
  assert.equal(graveyardNames(state, 'player2').includes('Mixed Relic B'), true);
  assert.equal(state.players.player2.life, 38);
  assert.equal(state.players.player3.life, 38);
  assert.equal(state.players.player4.life, 38);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Mixed Ally').markedDamage, 0);
});
