import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { InspiringCall } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Keyword, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, handNames, makeCommander, settleEngine } from './helpers.ts';

function makeCreature(name: string) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

function makeLibraryCard(name: string) {
  return CardBuilder.create(name)
    .types(CardType.SORCERY)
    .build();
}

test('Inspiring Call snapshots the creatures with +1/+1 counters on resolution', async () => {
  const counteredBearA = makeCreature('Countered Bear A');
  const counteredBearB = makeCreature('Countered Bear B');
  const freshBear = makeCreature('Fresh Bear');
  const drawnCardA = makeLibraryCard('Drawn Card A');
  const drawnCardB = makeLibraryCard('Drawn Card B');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Inspiring Call Commander', '{G}'),
        cards: [InspiringCall, counteredBearA, counteredBearB, freshBear, drawnCardA, drawnCardB],
        playerName: 'Caller',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Inspiring Call' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Countered Bear A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Countered Bear B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Fresh Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Countered Bear A' }, { counters: { '+1/+1': 1 } })
        .setBattlefieldCard({ playerId: 'player1', name: 'Countered Bear B' }, { counters: { '+1/+1': 2 } })
        .moveCard({ playerId: 'player1', name: 'Drawn Card A' }, Zone.LIBRARY, { position: 'top' })
        .moveCard({ playerId: 'player1', name: 'Drawn Card B' }, Zone.LIBRARY, { position: 'top' })
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

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Inspiring Call').objectId,
  });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player1').sort(), ['Drawn Card A', 'Drawn Card B'].sort());

  const counteredBearAAfter = getCard(state, 'player1', Zone.BATTLEFIELD, 'Countered Bear A');
  const counteredBearBAfter = getCard(state, 'player1', Zone.BATTLEFIELD, 'Countered Bear B');
  const freshBearAfterCast = getCard(state, 'player1', Zone.BATTLEFIELD, 'Fresh Bear');

  assert.ok((counteredBearAAfter.modifiedKeywords ?? []).includes(Keyword.INDESTRUCTIBLE));
  assert.ok((counteredBearBAfter.modifiedKeywords ?? []).includes(Keyword.INDESTRUCTIBLE));
  assert.ok(!(freshBearAfterCast.modifiedKeywords ?? []).includes(Keyword.INDESTRUCTIBLE));

  engine.addCounters(freshBearAfterCast.objectId, '+1/+1', 1, { player: 'player1' });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player1').sort(), ['Drawn Card A', 'Drawn Card B'].sort());

  const freshBearAfterCounter = getCard(state, 'player1', Zone.BATTLEFIELD, 'Fresh Bear');
  assert.equal(freshBearAfterCounter.counters['+1/+1'], 1);
  assert.ok(!(freshBearAfterCounter.modifiedKeywords ?? []).includes(Keyword.INDESTRUCTIBLE));
});
