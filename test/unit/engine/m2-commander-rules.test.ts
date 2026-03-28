import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { prebuiltDecks } from '../../../src/cards/decks.ts';
import { type DeckConfig } from '../../../src/engine/GameState.ts';
import { CardType, ManaColor, Zone, ActionType, Phase, Step } from '../../../src/engine/types.ts';
import { createHarness, commandNames, getLegalAction, graveyardNames, handNames } from './helpers.ts';

function makeTaggedCommander(
  name: string,
  manaCost: string,
  color: ManaColor,
  tags: string[] = [],
) {
  const commanderOptions = {
    partner: tags.includes('partner') || undefined,
    friendsForever: tags.includes('friends-forever') || undefined,
    partnerWith: tags.find((tag) => tag.startsWith('partner-with:'))?.slice('partner-with:'.length),
    chooseABackground: tags.includes('choose-a-background') || undefined,
  };
  const builder = CardBuilder.create(name)
    .cost(manaCost)
    .types(CardType.CREATURE)
    .supertypes('Legendary')
    .colors(color)
    .stats(3, 3);
  if (tags.includes('background')) {
    builder.subtypes('Background');
  }
  return {
    ...builder.build(),
    commanderOptions,
  };
}

test('commander zone replacement is engine-driven across graveyard, exile, hand, and library', () => {
  const commander = makeTaggedCommander('Replacement Commander', '{2}', ManaColor.WHITE);
  const decks: DeckConfig[] = [
    { commander, cards: [], playerName: 'Commander One' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    choiceResponder: (request) => {
      if (request.type === 'chooseYesNo') {
        request.resolve(!request.prompt.includes('their hand'));
        return;
      }
      request.resolve(request.options[0]);
    },
  });

  const commanderId = state.players.player1.commanderIds[0];

  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  engine.destroyPermanent(commanderId);
  assert.deepEqual(commandNames(state, 'player1'), ['Replacement Commander']);
  assert.deepEqual(graveyardNames(state, 'player1'), []);

  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  engine.exilePermanent(commanderId);
  assert.deepEqual(commandNames(state, 'player1'), ['Replacement Commander']);
  assert.equal(state.zones.player1.EXILE.length, 0);

  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  engine.returnToHand(commanderId);
  assert.deepEqual(handNames(state, 'player1'), ['Replacement Commander']);
  assert.deepEqual(commandNames(state, 'player1'), []);

  engine.moveCard(commanderId, Zone.LIBRARY, 'player1');
  assert.deepEqual(commandNames(state, 'player1'), ['Replacement Commander']);
  assert.equal(state.zones.player1.LIBRARY.some(card => card.cardId === commanderId), false);
});

test('commander tax and commander damage persist by stable commander identity across zone changes', () => {
  const commander = makeTaggedCommander('Tax Commander', '{2}', ManaColor.BLUE);
  const decks: DeckConfig[] = [
    { commander, cards: [], playerName: 'Commander One' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: Phase.PRECOMBAT_MAIN,
        currentStep: Step.MAIN,
        priorityPlayer: 'player1',
        passedPriority: [],
      });
    },
  });
  const commanderId = state.players.player1.commanderIds[0];

  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  engine.dealDamage(commanderId, 'player2', 5, true);
  engine.moveCard(commanderId, Zone.COMMAND, 'player1');
  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  engine.dealDamage(commanderId, 'player2', 6, true);

  assert.equal(state.players.player2.commanderDamageReceived[commanderId], 11);

  engine.moveCard(commanderId, Zone.COMMAND, 'player1');
  state.players.player1.commanderTimesCast[commanderId] = 2;
  engine.addMana('player1', 'C', 5);

  const notEnoughManaActions = engine.getLegalActions('player1').filter(action =>
    action.type === ActionType.CAST_SPELL && action.cardId === commanderId
  );
  assert.equal(notEnoughManaActions.length, 0);

  engine.addMana('player1', 'C', 1);
  const castCommander = getLegalAction(engine, 'player1', action =>
    action.type === ActionType.CAST_SPELL && action.cardId === commanderId
  );
  assert.equal(castCommander.type, ActionType.CAST_SPELL);
});

test('partner commanders have independent tax and damage tracking and union color identity', () => {
  const firstPartner = makeTaggedCommander('Partner Alpha', '{2}', ManaColor.WHITE, ['partner']);
  const secondPartner = makeTaggedCommander('Partner Beta', '{2}', ManaColor.BLUE, ['partner']);
  const decks: DeckConfig[] = [
    {
      commander: firstPartner,
      commanders: [firstPartner, secondPartner],
      cards: [],
      playerName: 'Partner Pair',
    },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: Phase.PRECOMBAT_MAIN,
        currentStep: Step.MAIN,
        priorityPlayer: 'player1',
        passedPriority: [],
      });
    },
  });
  const [firstCommanderId, secondCommanderId] = state.players.player1.commanderIds;

  assert.equal(state.players.player1.commanderIds.length, 2);
  assert.deepEqual([...state.players.player1.colorIdentity].sort(), [ManaColor.BLUE, ManaColor.WHITE]);

  state.players.player1.commanderTimesCast[firstCommanderId] = 1;
  engine.addMana('player1', 'C', 2);

  const actionsWithTax = engine.getLegalActions('player1')
    .filter(action => action.type === ActionType.CAST_SPELL)
    .map(action => action.cardId);
  assert.equal(actionsWithTax.includes(firstCommanderId), false);
  assert.equal(actionsWithTax.includes(secondCommanderId), true);

  engine.moveCard(firstCommanderId, Zone.BATTLEFIELD, 'player1');
  engine.dealDamage(firstCommanderId, 'player2', 3, true);
  engine.moveCard(secondCommanderId, Zone.BATTLEFIELD, 'player1');
  engine.dealDamage(secondCommanderId, 'player2', 4, true);

  assert.equal(state.players.player2.commanderDamageReceived[firstCommanderId], 3);
  assert.equal(state.players.player2.commanderDamageReceived[secondCommanderId], 4);
});
