import assert from 'node:assert/strict';
import test from 'node:test';

import { BlasphemousAct } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, makeCommander } from './helpers.ts';
import { CardBuilder } from '../../../src/cards/CardBuilder.ts';

test('Blasphemous Act is castable when battlefield creatures reduce its generic cost', () => {
  const mountain = CardBuilder.create('Cast Mountain')
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
  const alliedCreature = CardBuilder.create('Allied Body')
    .cost('{1}{R}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
  const opposingCreature = CardBuilder.create('Opposing Body')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Red Commander', '{R}'),
        cards: [BlasphemousAct, mountain, alliedCreature, alliedCreature, alliedCreature, alliedCreature, alliedCreature],
        playerName: 'Red',
      },
      {
        commander: makeCommander('Green Commander', '{G}'),
        cards: [opposingCreature, opposingCreature, opposingCreature],
        playerName: 'Green',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Blasphemous Act' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Cast Mountain' }, Zone.BATTLEFIELD);
      for (let nth = 0; nth < 5; nth++) {
        builder.moveCard({ playerId: 'player1', name: 'Allied Body', nth }, Zone.BATTLEFIELD);
      }
      for (let nth = 0; nth < 3; nth++) {
        builder.moveCard({ playerId: 'player2', name: 'Opposing Body', nth }, Zone.BATTLEFIELD);
      }
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: Phase.PRECOMBAT_MAIN,
        currentStep: Step.MAIN,
        priorityPlayer: 'player1',
        passedPriority: [],
      });
    },
  });

  const castAction = getLegalAction(engine, 'player1', (action) =>
    action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Blasphemous Act').objectId,
  );

  assert.equal(castAction.type, ActionType.CAST_SPELL);
});

test('Blasphemous Act deals 13 damage to each creature and SBAs move lethal casualties to graveyards', async () => {
  const mountain = CardBuilder.create('Resolution Mountain')
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
  const followUpMountain = CardBuilder.create('Follow-Up Mountain')
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
  const casterCreature = CardBuilder.create('Caster Creature')
    .cost('{1}{R}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .build();
  const opposingCreature = CardBuilder.create('Opposing Creature')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .stats(6, 6)
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Act Commander', '{R}'),
        cards: [BlasphemousAct, mountain, followUpMountain, casterCreature, casterCreature, casterCreature, casterCreature, casterCreature],
        playerName: 'Red',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [opposingCreature, opposingCreature, opposingCreature],
        playerName: 'Green',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Blasphemous Act' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Mountain' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Resolution Mountain' }, Zone.BATTLEFIELD);
      for (let nth = 0; nth < 5; nth++) {
        builder.moveCard({ playerId: 'player1', name: 'Caster Creature', nth }, Zone.BATTLEFIELD);
      }
      for (let nth = 0; nth < 3; nth++) {
        builder.moveCard({ playerId: 'player2', name: 'Opposing Creature', nth }, Zone.BATTLEFIELD);
      }
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: Phase.PRECOMBAT_MAIN,
        currentStep: Step.MAIN,
        priorityPlayer: 'player1',
        passedPriority: [],
      });
    },
  });

  await engine.submitAction(getLegalAction(engine, 'player1', (action) =>
    action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Blasphemous Act').objectId,
  ));

  assert.ok(graveyardNames(state, 'player1').includes('Blasphemous Act'));
  assert.equal(graveyardNames(state, 'player1').filter((name) => name === 'Caster Creature').length, 5);
  assert.equal(graveyardNames(state, 'player2').filter((name) => name === 'Opposing Creature').length, 3);
  assert.equal(state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Caster Creature'), false);
  assert.equal(state.zones.player2.BATTLEFIELD.some((card) => card.definition.name === 'Opposing Creature'), false);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Resolution Mountain').tapped, true);
});
