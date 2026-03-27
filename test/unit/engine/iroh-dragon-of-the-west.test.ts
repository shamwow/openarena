import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { IrohDragonOfTheWest } from '../../../src/cards/sets/starter/creatures.ts';
import { getEffectiveAbilities } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

function makeVanillaCreature(name: string, power = 2, toughness = 2) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

async function runLoop(engine: ReturnType<typeof createHarness>['engine']) {
  await (engine as unknown as { runGameLoop(): Promise<void> }).runGameLoop();
  await settleEngine();
}

async function resolveTopOfStack(engine: ReturnType<typeof createHarness>['engine']) {
  await (engine as unknown as { resolveTopOfStack(): Promise<void> }).resolveTopOfStack();
  await settleEngine();
}

test('Iroh grants firebending 2 to your creatures with counters at beginning of combat', async () => {
  const counteredAlly = makeVanillaCreature('Countered Ally', 1, 1);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Iroh Commander', '{R}'),
        cards: [IrohDragonOfTheWest, counteredAlly],
        playerName: 'Iroh',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Iroh, Dragon of the West' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Countered Ally' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Iroh, Dragon of the West' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Countered Ally' }, {
          summoningSick: false,
          counters: { '+1/+1': 1 },
        })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const internalEngine = engine as unknown as {
    turnManager: { advanceStep: (game: typeof state) => void };
  };

  internalEngine.turnManager.advanceStep(state);
  await runLoop(engine);

  const grantedAbilities = getEffectiveAbilities(getCard(state, 'player1', Zone.BATTLEFIELD, 'Countered Ally'));
  assert.equal(
    grantedAbilities.some((ability) => ability.kind === 'triggered' && ability.description === 'Firebending 2'),
    true,
  );

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

  const attackerId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Countered Ally').objectId;
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
  await runLoop(engine);
  await resolveTopOfStack(engine);

  assert.ok(
    state.eventLog.some(
      (event) => event.type === 'MANA_PRODUCED' && event.player === 'player1' && event.amount === 2,
    ),
  );
});

test('Iroh mentor puts a +1/+1 counter on another attacking creature with lesser power', async () => {
  const supportAlly = makeVanillaCreature('Support Ally', 2, 2);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Iroh Commander', '{R}'),
        cards: [IrohDragonOfTheWest, supportAlly],
        playerName: 'Iroh',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Iroh, Dragon of the West' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Ally' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Iroh, Dragon of the West' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Ally' }, { summoningSick: false })
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

  const irohId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Iroh, Dragon of the West').objectId;
  const supportAllyId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Support Ally').objectId;

  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.DECLARE_ATTACKERS,
    ),
    attackers: [
      {
        attackerId: irohId,
        defender: { type: 'player', id: 'player2' },
      },
      {
        attackerId: supportAllyId,
        defender: { type: 'player', id: 'player2' },
      },
    ],
  });
  await runLoop(engine);
  await resolveTopOfStack(engine);

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Support Ally').counters['+1/+1'], 1);
});
