import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { HowToStartARiot } from '../../../src/cards/sets/starter/spells.ts';
import { hasAbilityDescription } from '../../../src/engine/AbilityPrimitives.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, makeCommander, settleEngine } from './helpers.ts';

function makeCreature(name: string, power = 2, toughness = 2) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

test('How to Start a Riot grants menace and pumps the chosen player\'s creatures', async () => {
  const targetCreature = makeCreature('Riot Target');
  const playerOneBody = makeCreature('Player One Body');
  const playerTwoBodyA = makeCreature('Player Two Body A');
  const playerTwoBodyB = makeCreature('Player Two Body B');
  const playerOneFillers = Array.from({ length: 12 }, (_, index) => makeCreature(`Player One Filler ${index + 1}`));
  const playerTwoFillers = Array.from({ length: 12 }, (_, index) => makeCreature(`Player Two Filler ${index + 1}`));

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Riot Commander', '{R}'),
        cards: [HowToStartARiot, targetCreature, playerOneBody, ...playerOneFillers],
        playerName: 'Riot Player',
      },
      {
        commander: makeCommander('Target Player Commander', '{2}'),
        cards: [playerTwoBodyA, playerTwoBodyB, ...playerTwoFillers],
        playerName: 'Target Player',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'How to Start a Riot' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Riot Target' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Player One Body' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Player Two Body A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Player Two Body B' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const riotSpell = HowToStartARiot.spell;
  const playerTwoId = 'player2';
  assert.equal(riotSpell?.kind, 'simple');
  assert.ok(riotSpell);

  const riotSource = getCard(state, 'player1', Zone.HAND, 'How to Start a Riot');
  await riotSpell.effect({
    game: engine,
    state,
    source: riotSource,
    controller: 'player1',
    targets: [getCard(state, 'player1', Zone.BATTLEFIELD, 'Riot Target'), playerTwoId],
    choices: {
      chooseOne: async () => null,
      chooseN: async () => [],
      chooseUpToN: async () => [],
      chooseYesNo: async () => false,
      chooseTargets: async () => [],
      orderObjects: async (_prompt, objects) => objects,
      choosePlayer: async () => 'player2',
    },
    chooseTarget: async () => null,
    chooseTargets: async () => [],
  });

  const riotTarget = getCard(state, 'player1', Zone.BATTLEFIELD, 'Riot Target');
  const playerOneBodyAfter = getCard(state, 'player1', Zone.BATTLEFIELD, 'Player One Body');
  const playerTwoBodyAAfter = getCard(state, 'player2', Zone.BATTLEFIELD, 'Player Two Body A');
  const playerTwoBodyBAfter = getCard(state, 'player2', Zone.BATTLEFIELD, 'Player Two Body B');

  assert.ok(hasAbilityDescription(riotTarget, 'Menace'));
  assert.equal(playerOneBodyAfter.modifiedPower ?? playerOneBodyAfter.definition.power ?? 0, 2);
  assert.equal(playerTwoBodyAAfter.modifiedPower ?? playerTwoBodyAAfter.definition.power ?? 0, 4);
  assert.equal(playerTwoBodyBAfter.modifiedPower ?? playerTwoBodyBAfter.definition.power ?? 0, 4);

  engine.returnToHand(playerTwoBodyAAfter.objectId);
  engine.moveCard(playerTwoBodyAAfter.objectId, Zone.BATTLEFIELD, 'player2');
  const internalEngine = engine as unknown as {
    continuousEffects: { applyAll: (game: typeof state) => void };
  };
  internalEngine.continuousEffects.applyAll(state);

  const playerTwoBodyAReturned = getCard(state, 'player2', Zone.BATTLEFIELD, 'Player Two Body A');
  assert.equal(playerTwoBodyAReturned.modifiedPower ?? playerTwoBodyAReturned.definition.power ?? 0, 2);

  engine.endTurn();
  state.priorityPlayer = 'player1';
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await settleEngine();

  const riotTargetAfterCleanup = getCard(state, 'player1', Zone.BATTLEFIELD, 'Riot Target');
  const playerTwoBodyAAfterCleanup = getCard(state, 'player2', Zone.BATTLEFIELD, 'Player Two Body A');
  const playerTwoBodyBAfterCleanup = getCard(state, 'player2', Zone.BATTLEFIELD, 'Player Two Body B');

  assert.ok(!hasAbilityDescription(riotTargetAfterCleanup, 'Menace'));
  assert.equal(playerTwoBodyAAfterCleanup.modifiedPower ?? playerTwoBodyAAfterCleanup.definition.power ?? 0, 2);
  assert.equal(playerTwoBodyBAfterCleanup.modifiedPower ?? playerTwoBodyBAfterCleanup.definition.power ?? 0, 2);
});
