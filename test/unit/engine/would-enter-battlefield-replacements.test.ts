import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine, zoneNames } from './helpers.ts';

function makeCreature(name: string, cost = '{2}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

function makeEntryRedirector(targetName: string) {
  return CardBuilder.create('Entry Redirector')
    .cost('{2}{U}')
    .types(CardType.ENCHANTMENT)
    .staticAbility({
      type: 'replacement',
      replaces: 'would-enter-battlefield',
      replace: (_game, _source, event) => {
        if (event.entering.definition.name !== targetName) {
          return { kind: 'enter', event };
        }
        return { kind: 'redirect', toZone: 'EXILE' };
      },
    }, { description: `${targetName} is exiled instead of entering the battlefield.` })
    .build();
}

function makeTokenEntryPreventer(tokenName: string) {
  return CardBuilder.create('Token Nullifier')
    .cost('{2}{W}')
    .types(CardType.ENCHANTMENT)
    .staticAbility({
      type: 'replacement',
      replaces: 'would-enter-battlefield',
      replace: (_game, _source, event) => {
        if (event.entering.definition.name !== tokenName) {
          return { kind: 'enter', event };
        }
        return { kind: 'prevent' };
      },
    }, { description: `${tokenName} tokens cannot enter the battlefield.` })
    .build();
}

function makeCopyTapper() {
  return CardBuilder.create('Copy Tapper')
    .cost('{1}{U}')
    .types(CardType.ENCHANTMENT)
    .staticAbility({
      type: 'replacement',
      replaces: 'would-enter-battlefield',
      replace: (_game, _source, event) => {
        if (!event.entering.copyOf) {
          return { kind: 'enter', event };
        }
        return {
          kind: 'enter',
          event: {
            ...event,
            entry: {
              ...event.entry,
              tapped: true,
            },
          },
        };
      },
    }, { description: 'Permanent copies enter tapped.' })
    .build();
}

test('would-enter-battlefield replacements can redirect a resolving permanent spell to exile', async () => {
  const redirectedCreature = makeCreature('Redirected Adept');
  const redirector = makeEntryRedirector('Redirected Adept');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Redirect Commander', '{2}{U}'),
        cards: [redirector, redirectedCreature],
        playerName: 'Redirect',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Entry Redirector' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Redirected Adept' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'C', 2);

  const cardId = getCard(state, 'player1', Zone.HAND, 'Redirected Adept').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === cardId,
    ),
  );
  await settleEngine();

  assert.equal(zoneNames(state, 'player1', Zone.BATTLEFIELD).includes('Redirected Adept'), false);
  assert.equal(zoneNames(state, 'player1', Zone.EXILE).includes('Redirected Adept'), true);
  assert.equal(state.eventLog.some(event => event.type === 'ENTERS_BATTLEFIELD' && event.objectId === cardId), false);
});

test('would-enter-battlefield replacements can prevent token entry without leaving a battlefield object behind', () => {
  const tokenName = 'Blocked Spirit';
  const tokenPreventer = makeTokenEntryPreventer(tokenName);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Token Commander', '{2}{W}'),
        cards: [tokenPreventer],
        playerName: 'Tokens',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder.moveCard({ playerId: 'player1', name: 'Token Nullifier' }, Zone.BATTLEFIELD);
    },
  });

  const token = engine.createToken('player1', {
    name: tokenName,
    types: [CardType.CREATURE],
    power: 1,
    toughness: 1,
    subtypes: ['Spirit'],
    keywords: [],
    abilities: [],
  });

  assert.equal(engine.getCard(token.objectId), undefined);
  assert.equal(state.eventLog.some(event => event.type === 'TOKEN_CREATED' && event.objectId === token.objectId), true);
  assert.equal(state.eventLog.some(event => event.type === 'ENTERS_BATTLEFIELD' && event.objectId === token.objectId), false);
});

test('would-enter-battlefield replacements apply to copyPermanent token copies', async () => {
  const original = makeCreature('Copy Target');
  const copyTapper = makeCopyTapper();

  const { engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Copy Commander', '{2}{U}'),
        cards: [copyTapper, original],
        playerName: 'Copy',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Copy Tapper' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Copy Target' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Copy Target' }, { summoningSick: false });
    },
  });

  const originalId = engine.getBattlefield({ name: 'Copy Target' }, 'player1')[0].objectId;
  const copy = engine.copyPermanent(originalId, 'player1');
  assert.ok(copy);
  await settleEngine();

  const copiedToken = engine.getCard(copy.objectId);
  assert.ok(copiedToken);
  assert.equal(copiedToken.copyOf, originalId);
  assert.equal(copiedToken.tapped, true);
});
