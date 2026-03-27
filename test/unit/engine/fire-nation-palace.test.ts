import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { FireNationPalace, Mountain } from '../../../src/cards/sets/starter/lands.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

function makeCreature(name: string) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

test('Fire Nation Palace enters untapped if you control a basic land', async () => {
  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Fire Commander', '{R}'), cards: [FireNationPalace, Mountain], playerName: 'Fire' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Mountain' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Fire Nation Palace' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const palaceId = getCard(state, 'player1', Zone.HAND, 'Fire Nation Palace').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.PLAY_LAND && action.cardId === palaceId,
    ),
  );
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Fire Nation Palace').tapped, false);
});

test('Fire Nation Palace grants firebending 4 that triggers on attack', async () => {
  const attacker = makeCreature('Palace Raider');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Fire Commander', '{R}'),
        cards: [FireNationPalace, Mountain, Mountain, attacker],
        playerName: 'Fire',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fire Nation Palace' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Mountain', nth: 0 }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Mountain', nth: 1 }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Palace Raider' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Palace Raider' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const palaceId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Fire Nation Palace').objectId;
  const attackerId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Palace Raider').objectId;

  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === palaceId &&
        action.abilityIndex === 1,
    ),
    targets: [attackerId],
  });
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Fire Nation Palace').tapped, true);
  assert.equal(state.players.player1.manaPool.R, 0);

  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.DECLARE_ATTACKERS;
  state.priorityPlayer = 'player1';
  state.passedPriority.clear();
  state.combat = {
    attackingPlayer: 'player1',
    attackers: new Map(),
    blockers: new Map(),
    blockerOrder: new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };

  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.DECLARE_ATTACKERS,
    ),
    attackers: [{
      attackerId,
      defender: { type: 'player', id: 'player2' },
    }],
  });
  await settleEngine();

  assert.ok(state.eventLog.some((event) => event.type === 'ATTACKS' && event.attackerId === attackerId));
  assert.ok(state.eventLog.some((event) => event.type === 'MANA_PRODUCED' && event.player === 'player1' && event.amount === 4));

  state.players.player1.manaPool.R = 4;
  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.END_OF_COMBAT;
  state.pendingExtraCombatPhases = [{}];

  const turnEngine = engine as unknown as {
    turnManager: { advanceStep: (game: typeof state) => void };
  };
  turnEngine.turnManager.advanceStep(state);

  assert.equal(state.players.player1.manaPool.R, 0);
  assert.equal(state.currentStep, Step.BEGINNING_OF_COMBAT);
});
