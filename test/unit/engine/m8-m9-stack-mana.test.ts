import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ActionType, CardType, Zone, parseManaCost } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

function makeLand(name: string, color: 'W' | 'U' | 'B' | 'R' | 'G') {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(
      color === 'W' ? 'Plains'
        : color === 'U' ? 'Island'
          : color === 'B' ? 'Swamp'
            : color === 'R' ? 'Mountain'
              : 'Forest',
    )
    .tapForMana(color)
    .build();
}

function makeColorlessRock(name: string, amount: number) {
  return CardBuilder.create(name)
    .types(CardType.ARTIFACT)
    .activated(
      { tap: true },
      (ctx) => ctx.game.addMana(ctx.controller, 'C', amount),
      {
        isManaAbility: true,
        description: `{T}: Add ${'{C}'.repeat(amount)}.`,
      },
    )
    .build();
}

function makeCommandTower() {
  return CardBuilder.create('Command Tower Test')
    .types(CardType.LAND)
    .tapForAnyColor()
    .build();
}

function makeTreasureSource() {
  return CardBuilder.create('Treasure Source')
    .types(CardType.ARTIFACT)
    .subtypes('Treasure')
    .activated(
      { tap: true, sacrifice: { self: true } },
      async (ctx) => {
        const color = await ctx.choices.chooseOne(
          'Add one mana of any color',
          ['W', 'U', 'B', 'R', 'G'] as const,
          choice => choice,
        );
        ctx.game.addMana(ctx.controller, color, 1);
      },
      {
        isManaAbility: true,
        description: '{T}, Sacrifice Treasure Source: Add one mana of any color.',
      },
    )
    .build();
}

function makeMarkedSpell(name: string, cost: string) {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.INSTANT)
    .spellEffect((ctx) => {
      const target = ctx.targets[0];
      if (!target || typeof target === 'string') return;
      ctx.game.addCounters(target.objectId, 'charge', ctx.xValue ?? 0);
    }, {
      targets: [{ what: 'creature', controller: 'opponent', count: 1 }],
    })
    .build();
}

function makeDestroySpell(name: string, cost: string) {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.INSTANT)
    .spellEffect((ctx) => {
      const target = ctx.targets[0];
      if (!target || typeof target === 'string') return;
      ctx.game.destroyPermanent(target.objectId);
    }, {
      targets: [{ what: 'creature', controller: 'opponent', count: 1 }],
    })
    .build();
}

function makeVanillaCreature(name: string) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

async function passUntilStackEmpty(engine: ReturnType<typeof createHarness>['engine'], state: ReturnType<typeof createHarness>['state']) {
  for (let i = 0; i < 24 && state.stack.length > 0; i++) {
    const priorityPlayer = state.priorityPlayer;
    assert.ok(priorityPlayer, 'Expected a priority player while the stack is non-empty.');
    await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: priorityPlayer });
    await settleEngine();
  }
  assert.equal(state.stack.length, 0, 'Expected the stack to fully resolve.');
}

test('spell copies preserve X and can resolve against new targets independently', async () => {
  const markedSpell = makeMarkedSpell('Marked Bolt', '{X}{R}');
  const targetA = makeVanillaCreature('Target A');
  const targetB = makeVanillaCreature('Target B');
  const responseSpell = makeDestroySpell('Dummy Response', '{U}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Spell Copy Commander', '{1}{R}'),
        cards: [markedSpell, makeLand('Red Source 1', 'R'), makeLand('Red Source 2', 'R'), makeLand('Red Source 3', 'R')],
        playerName: 'Caster',
      },
      {
        commander: makeCommander('Responder', '{1}{U}'),
        cards: [targetA, responseSpell, makeLand('Blue Source', 'U')],
        playerName: 'Responder',
      },
      {
        commander: makeCommander('Third Player', '{1}{G}'),
        cards: [targetB],
        playerName: 'Third',
      },
      {
        commander: makeCommander('Fourth Player', '{1}{W}'),
        cards: [],
        playerName: 'Fourth',
      },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Marked Bolt' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Red Source 1' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Red Source 2' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Red Source 3' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Blue Source' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Dummy Response' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Target A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player3', name: 'Target B' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Target A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player3', name: 'Target B' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: 'PRECOMBAT_MAIN',
          currentStep: 'MAIN',
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const targetACard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Target A');
  const targetBCard = getCard(state, 'player3', Zone.BATTLEFIELD, 'Target B');

  await engine.submitAction({
    ...getLegalAction(engine, 'player1', action =>
      action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Marked Bolt').objectId
    ),
    targets: [targetACard.objectId],
    xValue: 2,
  });
  await settleEngine();

  assert.equal(state.stack.length, 1);
  const original = state.stack[0];
  engine.copySpellOnStack(original.id, 'player1');
  assert.equal(state.stack.length, 2);

  const copy = state.stack[1];
  copy.targets = [targetBCard.objectId];
  copy.targetZoneChangeCounters = [targetBCard.zoneChangeCounter];

  await passUntilStackEmpty(engine, state);

  assert.equal(getCard(state, 'player2', Zone.BATTLEFIELD, 'Target A').counters.charge, 2);
  assert.equal(getCard(state, 'player3', Zone.BATTLEFIELD, 'Target B').counters.charge, 2);
  assert.equal(state.players.player1.spellsCastThisTurn, 1);
});

test('moved-and-returned permanents are illegal targets on resolution', async () => {
  const destroySpell = makeDestroySpell('Fizzle Bolt', '{R}');
  const target = makeVanillaCreature('Blink Target');
  const responseSpell = makeDestroySpell('Dummy Response', '{U}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Removal Commander', '{1}{R}'),
        cards: [destroySpell, makeLand('Red Source', 'R')],
        playerName: 'Caster',
      },
      {
        commander: makeCommander('Blink Commander', '{1}{U}'),
        cards: [target, responseSpell, makeLand('Blue Source', 'U')],
        playerName: 'Blinker',
      },
      {
        commander: makeCommander('Third', '{1}{G}'),
        cards: [],
        playerName: 'Third',
      },
      {
        commander: makeCommander('Fourth', '{1}{W}'),
        cards: [],
        playerName: 'Fourth',
      },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fizzle Bolt' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Red Source' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Blue Source' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Dummy Response' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Blink Target' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Blink Target' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: 'PRECOMBAT_MAIN',
          currentStep: 'MAIN',
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const originalTarget = getCard(state, 'player2', Zone.BATTLEFIELD, 'Blink Target');
  const spellId = getCard(state, 'player1', Zone.HAND, 'Fizzle Bolt').objectId;

  await engine.submitAction({
    ...getLegalAction(engine, 'player1', action =>
      action.type === ActionType.CAST_SPELL && action.cardId === spellId
    ),
    targets: [originalTarget.objectId],
  });
  await settleEngine();
  assert.equal(state.stack.length, 1);

  engine.returnToHand(originalTarget.objectId);
  engine.moveCard(originalTarget.objectId, Zone.BATTLEFIELD, 'player2');

  await passUntilStackEmpty(engine, state);

  assert.equal(state.zones.player2.BATTLEFIELD.some(card => card.definition.name === 'Blink Target'), true);
  assert.equal(state.eventLog.some(event => event.type === 'SPELL_COUNTERED' && event.objectId === spellId), true);
});

test('hybrid mana costs are payable through autotap planning', async () => {
  const hybridSpell = CardBuilder.create('Hybrid Burst')
    .cost('{W/U}{W/U}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();
  const azoriusCommander = CardBuilder.create('Azorius Commander')
    .cost('{W}{U}')
    .types(CardType.CREATURE)
    .supertypes('Legendary')
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: azoriusCommander,
        cards: [hybridSpell, makeLand('Hybrid Plains', 'W'), makeLand('Hybrid Island', 'U')],
        playerName: 'Hybrid',
      },
      {
        commander: makeCommander('Opponent', '{1}{B}'),
        cards: [],
        playerName: 'Opponent',
      },
      {
        commander: makeCommander('Third', '{1}{G}'),
        cards: [],
        playerName: 'Third',
      },
      {
        commander: makeCommander('Fourth', '{1}{R}'),
        cards: [],
        playerName: 'Fourth',
      },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Hybrid Burst' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Hybrid Plains' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Hybrid Island' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: 'PRECOMBAT_MAIN',
          currentStep: 'MAIN',
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const action = getLegalAction(engine, 'player1', candidate =>
    candidate.type === ActionType.CAST_SPELL && candidate.cardId === getCard(state, 'player1', Zone.HAND, 'Hybrid Burst').objectId
  );
  await engine.submitAction(action);
  await settleEngine();
  await passUntilStackEmpty(engine, state);

  assert.equal(state.zones.player1.GRAVEYARD.some(card => card.definition.name === 'Hybrid Burst'), true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Hybrid Plains').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Hybrid Island').tapped, true);
});

test('phyrexian mana can be paid with life', () => {
  const { state, engine } = createHarness();
  const success = engine.payMana('player1', parseManaCost('{W/P}'));
  assert.equal(success, true);
  assert.equal(state.players.player1.life, 38);
  assert.equal(state.players.player1.manaPool.W, 0);
});

test('off-identity mana production becomes colorless', () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('White Commander', '{1}{W}'),
        cards: [],
        playerName: 'White',
      },
      {
        commander: makeCommander('Blue Commander', '{1}{U}'),
        cards: [],
        playerName: 'Blue',
      },
      {
        commander: makeCommander('Black Commander', '{1}{B}'),
        cards: [],
        playerName: 'Black',
      },
      {
        commander: makeCommander('Red Commander', '{1}{R}'),
        cards: [],
        playerName: 'Red',
      },
    ],
  });

  engine.addMana('player1', 'U', 1);
  assert.equal(state.players.player1.manaPool.U, 0);
  assert.equal(state.players.player1.manaPool.C, 1);
});

test('commander tax casting can use mixed sources including Treasure', async () => {
  const commander = makeCommander('Tax Commander', '{2}{W}');
  const { state, engine } = createHarness({
    decks: [
      {
        commander,
        cards: [
          makeLand('Tax Plains', 'W'),
          makeCommandTower(),
          makeColorlessRock('Tax Sol Ring', 2),
          makeTreasureSource(),
        ],
        playerName: 'Tax Player',
      },
      {
        commander: makeCommander('Opponent', '{1}{U}'),
        cards: [],
        playerName: 'Opponent',
      },
      {
        commander: makeCommander('Third', '{1}{B}'),
        cards: [],
        playerName: 'Third',
      },
      {
        commander: makeCommander('Fourth', '{1}{R}'),
        cards: [],
        playerName: 'Fourth',
      },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Tax Plains' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Command Tower Test' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Tax Sol Ring' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Treasure Source' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: 'PRECOMBAT_MAIN',
          currentStep: 'MAIN',
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          const commanderId = game.players.player1.commanderIds[0];
          game.players.player1.commanderTimesCast[commanderId] = 1;
        });
    },
  });

  const commanderId = state.players.player1.commanderIds[0];
  const action = getLegalAction(engine, 'player1', candidate =>
    candidate.type === ActionType.CAST_SPELL && candidate.cardId === commanderId
  );
  await engine.submitAction(action);
  await settleEngine();
  await passUntilStackEmpty(engine, state);

  assert.equal(state.zones.player1.BATTLEFIELD.some(card => card.definition.name === 'Tax Commander'), true);
  assert.equal(state.zones.player1.BATTLEFIELD.some(card => card.definition.name === 'Treasure Source'), false);
});
