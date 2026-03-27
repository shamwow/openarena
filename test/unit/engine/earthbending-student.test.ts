import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { EarthbendingStudent } from '../../../src/cards/sets/starter/creatures.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

function makeBasicLand(name: string, subtype: string, color: 'W' | 'U' | 'B' | 'R' | 'G') {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype)
    .tapForMana(color)
    .build();
}

test('Earthbending Student earthbends a land and grants it vigilance while attacking', async () => {
  const practiceLand = makeBasicLand('Student Field', 'Forest', 'G');
  const supportLand = makeBasicLand('Quiet Field', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Student Commander', '{G}'),
        cards: [EarthbendingStudent, practiceLand, supportLand],
        playerName: 'Student',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earthbending Student' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Student Field' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Quiet Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Student Field' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Quiet Field' }, { summoningSick: false })
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

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Earthbending Student').objectId,
  ));
  await settleEngine();

  const land = getCard(state, 'player1', Zone.BATTLEFIELD, 'Student Field');
  const quietField = getCard(state, 'player1', Zone.BATTLEFIELD, 'Quiet Field');
  assert.equal(hasType(land, CardType.CREATURE), true);
  assert.equal(land.counters['+1/+1'], 2);
  assert.equal(land.modifiedPower, 2);
  assert.equal(land.modifiedToughness, 2);
  assert.equal((land.modifiedKeywords ?? []).includes('Haste'), true);
  assert.equal((land.modifiedKeywords ?? []).includes('Vigilance'), true);
  assert.equal((quietField.modifiedKeywords ?? []).includes('Vigilance'), false);

  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.DECLARE_ATTACKERS;
  state.priorityPlayer = 'player1';
  state.passedPriority = new Set();
  state.combat = {
    attackingPlayer: 'player1',
    attackers: new Map(),
    blockers: new Map(),
    blockerOrder: new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };

  await engine.submitAction({
    ...getLegalAction(engine, 'player1', (action) => action.type === ActionType.DECLARE_ATTACKERS),
    type: ActionType.DECLARE_ATTACKERS,
    playerId: 'player1',
    attackers: [{
      attackerId: land.objectId,
      defender: { type: 'player', id: 'player2' },
    }],
  });
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Student Field').tapped, false);
});
