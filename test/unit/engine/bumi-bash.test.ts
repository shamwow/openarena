import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { BumiBash } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, graveyardNames, handNames, makeCommander } from './helpers.ts';

function makeLand(name: string, opts: { basic?: boolean; creature?: boolean } = {}) {
  const builder = CardBuilder.create(name)
    .types(...(opts.creature ? [CardType.LAND, CardType.CREATURE] : [CardType.LAND]))
    .subtypes('Mountain');

  if (opts.basic) {
    builder.supertypes('Basic');
  }

  if (opts.creature) {
    builder.stats(3, 3);
  }

  return builder.build();
}

function makeCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

test('Bumi Bash damage mode counts only lands you control', async () => {
  const playerLand = makeLand('Counting Mountain');
  const opposingLand = makeLand('Opponent Mountain');
  const stabilizerLand = makeLand('Target Stabilizer');
  const targetCreature = makeCreature('Large Target', 4, 5);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{R}'),
        cards: [BumiBash, playerLand, playerLand, playerLand, playerLand],
        playerName: 'Bumi',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [opposingLand, opposingLand, stabilizerLand, targetCreature],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder.moveCard({ playerId: 'player1', name: 'Bumi Bash' }, Zone.HAND);
      for (let nth = 0; nth < 4; nth++) {
        builder.moveCard({ playerId: 'player1', name: 'Counting Mountain', nth }, Zone.BATTLEFIELD);
      }
      for (let nth = 0; nth < 2; nth++) {
        builder.moveCard({ playerId: 'player2', name: 'Opponent Mountain', nth }, Zone.BATTLEFIELD);
      }
      builder
        .moveCard({ playerId: 'player2', name: 'Large Target' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'R', 4);

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Large Target').objectId;
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Bumi Bash').objectId,
    modeChoices: [0],
    targets: [targetId],
  });

  const damageEvent = [...state.eventLog].reverse().find((event) => event.type === 'DAMAGE_DEALT');
  assert.equal(damageEvent?.amount, 4);
  assert.equal(damageEvent?.targetId, targetId);
  assert.equal(graveyardNames(state, 'player1').includes('Bumi Bash'), true);
});

test('Bumi Bash destroy mode can target and destroy a land creature', async () => {
  const landCreature = makeLand('Animated Mesa', { creature: true });
  const stabilizerLand = makeLand('Target Stabilizer');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{R}'),
        cards: [BumiBash],
        playerName: 'Bumi',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [landCreature, stabilizerLand],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bumi Bash' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Animated Mesa' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'R', 4);

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Animated Mesa').objectId;
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Bumi Bash').objectId,
    modeChoices: [1],
    targets: [targetId],
  });

  const destroyedEvent = [...state.eventLog].reverse().find((event) => event.type === 'DESTROYED');
  assert.equal(destroyedEvent?.objectId, targetId);
  assert.equal(graveyardNames(state, 'player1').includes('Bumi Bash'), true);
});

test('Bumi Bash destroy mode can target a nonbasic land but not a basic land', async () => {
  const nonbasicLand = makeLand('Omashu');
  const basicLand = makeLand('Basic Mountain', { basic: true });
  const stabilizerLand = makeLand('Target Stabilizer');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{R}'),
        cards: [BumiBash, BumiBash],
        playerName: 'Bumi',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [nonbasicLand, basicLand, stabilizerLand],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bumi Bash', nth: 0 }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Bumi Bash', nth: 1 }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Omashu' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Basic Mountain' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'R', 8);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Bumi Bash').objectId,
    modeChoices: [1],
    targets: [getCard(state, 'player2', Zone.BATTLEFIELD, 'Omashu').objectId],
  });

  assert.equal(graveyardNames(state, 'player2').includes('Omashu'), true);
  assert.equal(graveyardNames(state, 'player1').filter((name) => name === 'Bumi Bash').length, 1);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Bumi Bash').objectId,
    modeChoices: [1],
    targets: [getCard(state, 'player2', Zone.BATTLEFIELD, 'Basic Mountain').objectId],
  });

  assert.equal(handNames(state, 'player1').includes('Bumi Bash'), true);
  assert.equal(graveyardNames(state, 'player1').filter((name) => name === 'Bumi Bash').length, 1);
  assert.equal(getCard(state, 'player2', Zone.BATTLEFIELD, 'Basic Mountain').definition.name, 'Basic Mountain');
});
