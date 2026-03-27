import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { HaruHiddenTalent } from '../../../src/cards/sets/starter/creatures.ts';
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

test('Haru, Hidden Talent only earthbends when another Ally enters under your control', async () => {
  const practiceField = makeBasicLand('Practice Field', 'Forest', 'G');
  const backupField = makeBasicLand('Backup Field', 'Forest', 'G');
  const alliedScout = CardBuilder.create('Allied Scout')
    .cost('{0}')
    .types(CardType.CREATURE)
    .subtypes('Human', 'Scout', 'Ally')
    .stats(1, 1)
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Haru Commander', '{G}'),
        cards: [HaruHiddenTalent, alliedScout, practiceField, backupField],
        playerName: 'Haru',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Haru, Hidden Talent' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Allied Scout' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Practice Field' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Backup Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Practice Field' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Backup Field' }, { summoningSick: false })
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

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Haru, Hidden Talent').objectId,
  ));
  await settleEngine();

  const fieldAfterHaru = getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Field');
  const backupAfterHaru = getCard(state, 'player1', Zone.BATTLEFIELD, 'Backup Field');
  assert.equal(hasType(fieldAfterHaru, CardType.CREATURE), false);
  assert.equal(hasType(backupAfterHaru, CardType.CREATURE), false);
  assert.equal(fieldAfterHaru.counters['+1/+1'] ?? 0, 0);
  assert.equal(backupAfterHaru.counters['+1/+1'] ?? 0, 0);

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Allied Scout').objectId,
  ));
  await settleEngine();

  const earthbentField = getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Field');
  const untouchedField = getCard(state, 'player1', Zone.BATTLEFIELD, 'Backup Field');
  assert.equal(hasType(earthbentField, CardType.CREATURE), true);
  assert.equal(earthbentField.counters['+1/+1'], 1);
  assert.equal(earthbentField.modifiedPower, 1);
  assert.equal(earthbentField.modifiedToughness, 1);
  assert.equal((earthbentField.modifiedKeywords ?? []).includes('Haste'), true);
  assert.equal(hasType(untouchedField, CardType.CREATURE), false);
});
