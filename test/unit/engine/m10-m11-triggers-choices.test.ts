import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ThoughtVessel } from '../../../src/cards/sets/starter/artifacts.ts';
import { ActionType, CardType, GameEventType, Step, Zone, type GameEvent } from '../../../src/engine/types.ts';
import { createHarness, battlefieldNames, getCard, graveyardNames, handNames, makeCommander } from './helpers.ts';
import type { ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import type { EventBus } from '../../../src/engine/EventBus.ts';

function manaCost(generic = 0) {
  return { generic, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 };
}

function scriptedResponder(script: (request: ChoiceRequest) => unknown) {
  return (request: ChoiceRequest) => {
    const result = script(request);
    if (result !== undefined) {
      request.resolve(result);
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

    if (request.type === 'chooseN' || request.type === 'chooseUpToN') {
      request.resolve(request.options.slice(0, request.count ?? 0));
      return;
    }

    if (request.type === 'orderObjects') {
      request.resolve(request.options);
      return;
    }

    request.resolve(request.options);
  };
}

test('registerDelayedTrigger stores a one-shot delayed trigger that matches the next end step', () => {
  const source = CardBuilder.create('Delayed Source')
    .cost('{2}')
    .types(CardType.ENCHANTMENT)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Delay Commander', '{2}'), cards: [source], playerName: 'Delay Player' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder.moveCard({ playerId: 'player1', name: 'Delayed Source' }, Zone.BATTLEFIELD);
    },
  });

  const sourceCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Delayed Source');
  engine.registerDelayedTrigger({
    id: 'delayed-1',
    controller: 'player1',
    source: sourceCard,
    expiresAfterTrigger: true,
    ability: {
      kind: 'triggered',
      trigger: { on: 'end-step', whose: 'each' },
      effect: (ctx) => {
        ctx.game.drawCards(ctx.controller, 1);
      },
      optional: false,
      description: 'At the beginning of the next end step, draw a card.',
    },
  });

  const eventBus = (engine as unknown as { eventBus: EventBus }).eventBus;
  const endStepEvent: GameEvent = {
    type: GameEventType.STEP_CHANGE,
    timestamp: state.timestampCounter++,
    phase: 'ENDING',
    step: Step.END,
    activePlayer: 'player1',
  };

  const triggers = eventBus.checkTriggers(endStepEvent, state);
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0].delayedTriggerId, 'delayed-1');
  assert.equal(state.delayedTriggers.length, 1);
});

test('shared sacrifice primitives handle sacrifice-as-cost and queue dies triggers', async () => {
  const drainArtist = CardBuilder.create('Drain Artist')
    .cost('{1}{B}')
    .types(CardType.CREATURE)
    .stats(0, 1)
    .triggered(
      { on: 'dies', filter: { types: [CardType.CREATURE] } },
      async (ctx) => {
        const target = await ctx.choices.choosePlayer('Choose a player to lose 1 life', ctx.game.getOpponents(ctx.controller));
        ctx.game.loseLife(target, 1);
        ctx.game.gainLife(ctx.controller, 1);
      },
      { optional: false, description: 'Whenever a creature dies, target opponent loses 1 life and you gain 1 life.' },
    )
    .build();

  const fodder = CardBuilder.create('Sacrifice Fodder')
    .cost('{1}')
    .types(CardType.CREATURE)
    .stats(1, 1)
    .build();

  const { state, engine } = createHarness({
    choiceResponder: scriptedResponder(() => undefined),
    decks: [
      { commander: makeCommander('Sacrifice Commander', '{2}'), cards: [drainArtist, fodder], playerName: 'Sac Player' },
      { commander: makeCommander('Target Commander', '{2}'), cards: [], playerName: 'Target Player' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Drain Artist' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Drain Artist' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Sacrifice Fodder' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Sacrifice Fodder' }, { summoningSick: false });
    },
  });

  const selected = await engine.sacrificePermanents(
    'player1',
    { name: 'Sacrifice Fodder', types: [CardType.CREATURE] },
    1,
    'Choose a creature to sacrifice',
  );

  assert.equal(selected.length, 1);
  assert.deepEqual(graveyardNames(state, 'player1'), ['Sacrifice Fodder']);
  assert.ok(state.pendingTriggers.some(trigger => trigger.source.definition.name === 'Drain Artist'));
});

test('unlessPlayerPays and predefined Treasure tokens provide shared Rhystic/Tithe-style plumbing', async () => {
  const responder = scriptedResponder((request) => {
    if (request.type === 'chooseYesNo' && request.prompt.includes('Pay {2}')) {
      return false;
    }
    if (request.type === 'chooseOne' && request.prompt.includes('Add one mana of any color')) {
      return 'R';
    }
    return undefined;
  });

  const { state, engine } = createHarness({
    choiceResponder: responder,
    decks: [
      { commander: makeCommander('Drawer Commander', '{2}'), cards: [], playerName: 'Drawer' },
      { commander: makeCommander('Tithe Commander', '{2}'), cards: [], playerName: 'Tithe' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
  });

  const paid = await engine.unlessPlayerPays('player1', state.players.player1.commanderIds[0], { mana: manaCost(2) }, 'Pay {2}?');
  assert.equal(paid, false);

  const treasure = engine.createPredefinedToken('player2', 'Treasure');
  assert.ok(battlefieldNames(state, 'player2').includes('Treasure'));
  assert.equal(treasure.definition.subtypes.includes('Treasure'), true);

  const effect = treasure.definition.abilities[0];
  assert.equal(effect.kind, 'activated');
  await effect.effect({
    game: engine,
    state,
    source: treasure,
    controller: 'player2',
    targets: [],
    choices: {
      chooseOne: async () => 'R',
      chooseN: async () => [],
      chooseUpToN: async () => [],
      chooseYesNo: async () => false,
      chooseTargets: async () => [],
      orderObjects: async (_prompt, objects) => objects,
      choosePlayer: async () => 'player1',
    },
    chooseTarget: async () => null,
    chooseTargets: async () => [],
  });
  engine.sacrificePermanent(treasure.objectId, 'player2');

  assert.equal(state.players.player2.manaPool.C, 1);
  assert.ok(!battlefieldNames(state, 'player2').includes('Treasure'));
});

test('advanced library search moves the chosen card to the requested zone', async () => {
  const prize = CardBuilder.create('Search Prize')
    .cost('{1}')
    .types(CardType.SORCERY)
    .build();

  const responder = scriptedResponder((request) => {
    if (request.type === 'chooseN' || request.type === 'chooseUpToN') {
      return request.options.filter((option: unknown) => (option as { definition: { name: string } }).definition.name === 'Search Prize');
    }
    return undefined;
  });

  const { state, engine } = createHarness({
    choiceResponder: responder,
    decks: [
      { commander: makeCommander('Tutor Commander', '{2}'), cards: [prize], playerName: 'Tutor Player' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
  });

  const selected = await engine.searchLibraryWithOptions({
    player: 'player1',
    filter: { name: 'Search Prize' },
    destination: Zone.HAND,
    count: 1,
    optional: false,
  });

  assert.equal(selected.length, 1);
  assert.ok(handNames(state, 'player1').includes('Search Prize'));
});

test('same-controller trigger ordering is player-choice-driven', async () => {
  const triggerMaker = CardBuilder.create('Maker Trigger')
    .cost('{2}')
    .types(CardType.ENCHANTMENT)
    .triggered(
      { on: 'cast-spell', filter: { controller: 'opponent' } },
      (ctx) => {
        ctx.game.createPredefinedToken(ctx.controller, 'Treasure');
      },
      { optional: false, description: 'Create a Treasure.' },
    )
    .build();
  const triggerChecker = CardBuilder.create('Checker Trigger')
    .cost('{2}')
    .types(CardType.ENCHANTMENT)
    .triggered(
      { on: 'cast-spell', filter: { controller: 'opponent' } },
      (ctx) => {
        if (ctx.game.getBattlefield({ name: 'Treasure' }, ctx.controller).length > 0) {
          ctx.game.drawCards(ctx.controller, 1);
        }
      },
      { optional: false, description: 'If you control a Treasure, draw a card.' },
    )
    .build();
  const drawBuffer = CardBuilder.create('Draw Buffer')
    .cost('{1}')
    .types(CardType.SORCERY)
    .build();
  const spell = CardBuilder.create('Trigger Test Spell')
    .cost('{W}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();

  const responder = scriptedResponder((request) => {
    if (request.type === 'orderObjects' && request.prompt.includes('Order your triggered abilities')) {
      const options = request.options as Array<{ source: { definition: { name: string } } }>;
      return [...options].sort((left, right) => left.source.definition.name.localeCompare(right.source.definition.name));
    }
    return undefined;
  });

  const { state, engine } = createHarness({
    choiceResponder: responder,
    decks: [
      { commander: makeCommander('Trigger Commander', '{2}'), cards: [triggerMaker, triggerChecker, drawBuffer], playerName: 'Trigger Player' },
      { commander: makeCommander('Caster Commander', '{W}'), cards: [spell], playerName: 'Caster' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Checker Trigger' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Maker Trigger' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Trigger Test Spell' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player2',
          currentPhase: 'PRECOMBAT_MAIN',
          currentStep: Step.MAIN,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player2', 'W', 1);
  const handBefore = handNames(state, 'player1').length;
  const internalEngine = engine as unknown as {
    handleCastSpell: (playerId: 'player2', cardId: string, targets: string[]) => Promise<void>;
    placePendingTriggers: () => Promise<boolean>;
    resolveTopOfStack: () => Promise<void>;
  };
  await internalEngine.handleCastSpell(
    'player2',
    getCard(state, 'player2', Zone.HAND, 'Trigger Test Spell').objectId,
    [],
  );
  assert.equal(await internalEngine.placePendingTriggers(), true);
  await internalEngine.resolveTopOfStack();
  await internalEngine.resolveTopOfStack();

  assert.equal(handNames(state, 'player1').length, handBefore + 1);
  assert.ok(battlefieldNames(state, 'player1').includes('Treasure'));
});

test('cleanup-step discard is player-choice-driven and respects no maximum hand size effects', async () => {
  const discardTarget = CardBuilder.create('Discard Me')
    .cost('{1}')
    .types(CardType.SORCERY)
    .build();
  const filler = Array.from({ length: 7 }, (_, index) =>
    CardBuilder.create(`Filler ${index + 1}`)
      .cost('{1}')
      .types(CardType.SORCERY)
      .build()
  );

  const discardResponder = scriptedResponder((request) => {
    if (request.type === 'chooseN' && request.prompt.includes('discard')) {
      return request.options.filter((option: unknown) => (option as { definition: { name: string } }).definition.name === 'Discard Me');
    }
    return undefined;
  });

  const baseDeck = {
    commander: makeCommander('Cleanup Commander', '{2}'),
    cards: [discardTarget, ...filler],
    playerName: 'Cleanup Player',
  };

  const firstHarness = createHarness({
    choiceResponder: discardResponder,
    decks: [
      baseDeck,
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Discard Me' }, Zone.HAND);
      for (let i = 0; i < filler.length; i++) {
        builder.moveCard({ playerId: 'player1', name: `Filler ${i + 1}` }, Zone.HAND);
      }
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: 'ENDING',
        currentStep: Step.CLEANUP,
        priorityPlayer: null,
        passedPriority: [],
      });
    },
  });

  const firstInternal = firstHarness.engine as unknown as { runGameLoop: () => Promise<void> };
  await firstInternal.runGameLoop();
  assert.ok(graveyardNames(firstHarness.state, 'player1').includes('Discard Me'));
  assert.equal(handNames(firstHarness.state, 'player1').length, 7);

  const secondHarness = createHarness({
    choiceResponder: discardResponder,
    decks: [
      {
        commander: makeCommander('Cleanup Commander', '{2}'),
        cards: [ThoughtVessel, discardTarget, ...filler],
        playerName: 'Cleanup Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Thought Vessel' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Discard Me' }, Zone.HAND);
      for (let i = 0; i < filler.length; i++) {
        builder.moveCard({ playerId: 'player1', name: `Filler ${i + 1}` }, Zone.HAND);
      }
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: 'ENDING',
        currentStep: Step.CLEANUP,
        priorityPlayer: null,
        passedPriority: [],
      });
    },
  });

  const secondInternal = secondHarness.engine as unknown as { runGameLoop: () => Promise<void> };
  await secondInternal.runGameLoop();
  assert.equal(handNames(secondHarness.state, 'player1').length, 8);
  assert.equal(graveyardNames(secondHarness.state, 'player1').length, 0);
});
