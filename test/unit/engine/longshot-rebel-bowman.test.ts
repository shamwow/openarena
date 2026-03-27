import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { LongshotRebelBowman } from '../../../src/cards/sets/starter/creatures.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, makeCommander } from './helpers.ts';

test('Longshot, Rebel Bowman reduces only your noncreature spells', () => {
  const mountain = CardBuilder.create('Longshot Mountain')
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
  const discountedSpell = CardBuilder.create('Discounted Spell')
    .cost('{1}{R}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();
  const fullPriceCreature = CardBuilder.create('Full Price Creature')
    .cost('{1}{R}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Longshot Commander', '{R}'),
        cards: [LongshotRebelBowman, mountain, discountedSpell, fullPriceCreature],
        playerName: 'Longshot Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Longshot, Rebel Bowman' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Longshot Mountain' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Discounted Spell' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Full Price Creature' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const legalActions = engine.getLegalActions('player1');
  const discountedAction = legalActions.find((action) =>
    action.type === ActionType.CAST_SPELL
    && action.cardId === getCard(state, 'player1', Zone.HAND, 'Discounted Spell').objectId,
  );
  const creatureAction = legalActions.find((action) =>
    action.type === ActionType.CAST_SPELL
    && action.cardId === getCard(state, 'player1', Zone.HAND, 'Full Price Creature').objectId,
  );

  assert.ok(discountedAction, 'expected discounted noncreature spell to be castable');
  assert.equal(creatureAction, undefined);
});

test('Longshot, Rebel Bowman deals 2 damage to each opponent when you cast a noncreature spell', async () => {
  const mountain = CardBuilder.create('Trigger Mountain')
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
  const triggerSpell = CardBuilder.create('Trigger Spell')
    .cost('{R}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Longshot Commander', '{R}'),
        cards: [LongshotRebelBowman, mountain, triggerSpell],
        playerName: 'Longshot Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Longshot, Rebel Bowman' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Trigger Mountain' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Trigger Spell' }, Zone.HAND)
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
    handleCastSpell: (playerId: 'player1', cardId: string, targets: string[]) => Promise<void>;
    placePendingTriggers: () => Promise<boolean>;
    resolveTopOfStack: () => Promise<void>;
  };

  await internalEngine.handleCastSpell(
    'player1',
    getCard(state, 'player1', Zone.HAND, 'Trigger Spell').objectId,
    [],
  );

  assert.equal(await internalEngine.placePendingTriggers(), true);
  assert.equal(state.stack.length, 2);

  await internalEngine.resolveTopOfStack();

  assert.equal(state.players.player1.life, 40);
  assert.equal(state.players.player2.life, 38);
  assert.equal(state.players.player3.life, 38);
  assert.equal(state.players.player4.life, 38);

  await internalEngine.resolveTopOfStack();
  assert.equal(state.stack.length, 0);
});

test('Longshot, Rebel Bowman applies to noncreature adventure spells using their adventure face', async () => {
  const mountain = CardBuilder.create('Adventure Mountain')
    .types(CardType.LAND)
    .subtypes('Mountain')
    .tapForMana('R')
    .build();
  const adventureCard = CardBuilder.create('Quiet Scout')
    .cost('{2}{R}')
    .types(CardType.CREATURE)
    .subtypes('Human', 'Scout')
    .stats(3, 2)
    .adventure('Silent Shot', '{1}{R}', [CardType.INSTANT], () => {})
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Longshot Commander', '{R}'),
        cards: [LongshotRebelBowman, mountain, adventureCard],
        playerName: 'Longshot Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Longshot, Rebel Bowman' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Adventure Mountain' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Quiet Scout' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const quietScoutId = getCard(state, 'player1', Zone.HAND, 'Quiet Scout').objectId;
  const legalAdventureAction = engine.getLegalActions('player1').find((action) =>
    action.type === ActionType.CAST_SPELL
    && action.cardId === quietScoutId
    && action.castAsAdventure === true,
  );

  assert.ok(legalAdventureAction, 'expected the adventure face to be discounted and castable');

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: quietScoutId,
    castAsAdventure: true,
  });

  assert.equal(state.players.player2.life, 38);
  assert.equal(state.players.player3.life, 38);
  assert.equal(state.players.player4.life, 38);
});
