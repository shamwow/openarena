import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ActionType, CardType, Phase, Step, StackEntryType, type StackEntry } from '../../../src/engine/types.ts';
import { GameEngineImpl } from '../../../src/engine/GameEngine.ts';
import { createHarness, makeCommander } from './helpers.ts';
import type { TurnManager } from '../../../src/engine/TurnManager.ts';

test('grantExtraTurn queues most recently granted turns first and skips eliminated players', () => {
  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{2}'), cards: [], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
  });

  state.activePlayer = 'player1';
  state.currentPhase = Phase.ENDING;
  state.currentStep = Step.CLEANUP;
  engine.grantExtraTurn('player2');
  engine.grantExtraTurn('player3');
  state.players.player3.hasLost = true;

  const turnManager = (engine as unknown as { turnManager: TurnManager }).turnManager;
  turnManager.advanceToNextTurn(state);

  assert.equal(state.activePlayer, 'player2');
  assert.deepEqual(state.pendingExtraTurns, []);
});

test('experience and energy counters are tracked at the player level', () => {
  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{2}'), cards: [], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
  });

  engine.addPlayerCounters('player1', 'experience', 3);
  engine.addPlayerCounters('player1', 'energy', 5);

  assert.equal(state.players.player1.experienceCounters, 3);
  assert.equal(state.players.player1.energyCounters, 5);
  assert.equal(engine.removePlayerCounters('player1', 'energy', 2), true);
  assert.equal(state.players.player1.energyCounters, 3);
  assert.equal(engine.removePlayerCounters('player1', 'experience', 4), false);
});

test('endTurn clears stack and combat and moves the game to cleanup', () => {
  const stackSpell = CardBuilder.create('Stack Spell')
    .cost('{1}')
    .types(CardType.SORCERY)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{2}'), cards: [stackSpell], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
  });

  const spell = state.zones.player1.LIBRARY.find(card => card.definition.name === 'Stack Spell');
  assert.ok(spell);
  if (!spell) return;

  state.stack.push({
    id: 'stack-entry',
    entryType: StackEntryType.SPELL,
    sourceId: spell.objectId,
    sourceCardId: spell.cardId,
    sourceZoneChangeCounter: spell.zoneChangeCounter,
    sourceSnapshot: spell,
    controller: 'player1',
    timestamp: state.timestampCounter++,
    targets: [],
    targetZoneChangeCounters: [],
    cardInstance: spell,
    resolve: () => {},
  } satisfies StackEntry);
  state.combat = {
    attackingPlayer: 'player1',
    attackers: new Map(),
    blockers: new Map(),
    blockerOrder: new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };

  engine.endTurn();

  assert.equal(state.stack.length, 0);
  assert.equal(state.combat, null);
  assert.equal(state.currentPhase, Phase.ENDING);
  assert.equal(state.currentStep, Step.CLEANUP);
});

test('Commander mulligan policy supports one free mulligan, then London bottoming', async () => {
  const buildDeck = (prefix: string) => ({
    commander: makeCommander(`${prefix} Commander`, '{2}'),
    cards: Array.from({ length: 8 }, (_, index) =>
      CardBuilder.create(`${prefix} Card ${index + 1}`)
        .cost('{1}')
        .types(CardType.SORCERY)
        .build()
    ),
    playerName: prefix,
  });

  const engine = new GameEngineImpl({
    decks: [
      buildDeck('P1'),
      buildDeck('P2'),
      buildDeck('P3'),
      buildDeck('P4'),
    ],
    drawOpeningHands: true,
    runGameLoopOnInit: false,
  });
  engine.onChoiceRequest((request) => {
    if (request.type === 'chooseN') {
      request.resolve(request.options.slice(0, request.count ?? 0));
      return;
    }
    if (request.type === 'chooseYesNo') {
      request.resolve(true);
      return;
    }
    if (request.type === 'chooseOne' || request.type === 'choosePlayer') {
      request.resolve(request.options[0]);
      return;
    }
    if (request.type === 'chooseUpToN') {
      request.resolve(request.options.slice(0, request.count ?? 0));
      return;
    }
    if (request.type === 'orderObjects') {
      request.resolve(request.options);
      return;
    }
    request.resolve(request.options);
  });

  const state = engine.getState();
  assert.ok(engine.getLegalActions('player1').some((action) => action.type === ActionType.MULLIGAN_TAKE));

  await engine.submitAction({ type: ActionType.MULLIGAN_TAKE, playerId: 'player1' });
  assert.equal(state.zones.player1.HAND.length, 7);

  await engine.submitAction({ type: ActionType.MULLIGAN_TAKE, playerId: 'player1' });
  assert.equal(state.zones.player1.HAND.length, 7);

  await engine.submitAction({ type: ActionType.MULLIGAN_KEEP, playerId: 'player1' });
  assert.equal(state.zones.player1.HAND.length, 6);

  await engine.submitAction({ type: ActionType.MULLIGAN_KEEP, playerId: 'player2' });
  await engine.submitAction({ type: ActionType.MULLIGAN_KEEP, playerId: 'player3' });
  await engine.submitAction({ type: ActionType.MULLIGAN_KEEP, playerId: 'player4' });

  assert.equal(state.mulliganState, undefined);
});

test('initiative holder is tracked and clears when that player leaves the game', async () => {
  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{2}'), cards: [], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
  });

  engine.becomeInitiativeHolder('player2');
  assert.equal(state.initiativeHolder, 'player2');

  await engine.submitAction({ type: ActionType.CONCEDE, playerId: 'player2' });
  assert.equal(state.initiativeHolder, undefined);
});
