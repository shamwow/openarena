import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { CrystallineArmor } from '../../../src/cards/sets/starter/enchantments.ts';
import { hasAbilityDescription } from '../../../src/engine/AbilityPrimitives.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import {
  createHarness,
  getCard,
  getLegalAction,
  makeCommander,
  settleEngine,
} from './helpers.ts';

function makeTestLand(name: string, color: 'G' | 'R') {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .tapForMana(color)
    .build();
}

function makeHostCreature(name: string) {
  return CardBuilder.create(name)
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

test('Crystalline Armor attaches, grants trample, and counts only lands you control', async () => {
  const decks = [
    {
      commander: makeCommander('Armor Commander', '{G}'),
      cards: [
        CrystallineArmor,
        makeHostCreature('Armor Bear'),
        makeTestLand('Armor Forest A', 'G'),
        makeTestLand('Armor Forest B', 'G'),
      ],
      playerName: 'Armor Player',
    },
    {
      commander: makeCommander('Opponent Commander', '{R}'),
      cards: [
        makeTestLand('Opponent Mountain A', 'R'),
        makeTestLand('Opponent Mountain B', 'R'),
      ],
      playerName: 'Opponent Player',
    },
    { commander: makeCommander('Third Commander', '{G}'), cards: [], playerName: 'Third Player' },
    { commander: makeCommander('Fourth Commander', '{G}'), cards: [], playerName: 'Fourth Player' },
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Crystalline Armor' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Armor Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Armor Bear' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Armor Forest A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Armor Forest B' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Opponent Mountain A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Opponent Mountain B' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 4);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Crystalline Armor').objectId,
    targets: [getCard(state, 'player1', Zone.BATTLEFIELD, 'Armor Bear').objectId],
  });
  await settleEngine();

  const armor = getCard(state, 'player1', Zone.BATTLEFIELD, 'Crystalline Armor');
  const host = getCard(state, 'player1', Zone.BATTLEFIELD, 'Armor Bear');

  assert.equal(armor.attachedTo, host.objectId);
  assert.ok(host.attachments.includes(armor.objectId));
  assert.ok(hasAbilityDescription(host, 'Trample'));
  assert.equal(host.modifiedPower, 3);
  assert.equal(host.modifiedToughness, 3);

  state.priorityPlayer = 'player1';
  const playLand = getLegalAction(
    engine,
    'player1',
    action => action.type === ActionType.PLAY_LAND && action.cardId === getCard(state, 'player1', Zone.HAND, 'Armor Forest B').objectId,
  );
  await engine.submitAction(playLand);
  await settleEngine();

  assert.equal(host.modifiedPower, 4);
  assert.equal(host.modifiedToughness, 4);
  assert.ok(state.zones.player1.BATTLEFIELD.some(card => card.definition.name === 'Armor Forest B'));
});
