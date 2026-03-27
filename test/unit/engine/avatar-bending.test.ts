import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone, parseManaCost } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeVanillaCreature(name: string) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

function makeVanillaArtifact(name: string) {
  return CardBuilder.create(name)
    .cost('{1}')
    .types(CardType.ARTIFACT)
    .build();
}

function makeBasicLand(name: string, subtype: string, color: 'W' | 'U' | 'B' | 'R' | 'G') {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype)
    .tapForMana(color)
    .build();
}

function makeCreatureManaDork(name: string, color: 'W' | 'U' | 'B' | 'R' | 'G') {
  return CardBuilder.create(name)
    .cost('{G}')
    .types(CardType.CREATURE)
    .stats(1, 1)
    .tapForMana(color)
    .build();
}

function makeBadgermoleCub() {
  return CardBuilder.create('Badgermole Cub')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .subtypes('Badger', 'Mole')
    .stats(2, 2)
    .triggered(
      { on: 'tap-for-mana', filter: { types: [CardType.CREATURE], controller: 'you' } },
      (ctx) => {
        ctx.game.addMana(ctx.controller, 'G', 1);
      },
      {
        isManaAbility: true,
        manaProduction: [{ amount: 1, colors: ['G'] }],
        description: 'Whenever you tap a creature for mana, add an additional {G}.',
      },
    )
    .build();
}

async function runLoop(engine: ReturnType<typeof createHarness>['engine']) {
  await (engine as unknown as { runGameLoop(): Promise<void> }).runGameLoop();
  await settleEngine();
}

test('waterbending lets spells tap untapped artifacts and summoning-sick creatures for generic mana', async () => {
  const waterSpell = CardBuilder.create('Water Whip')
    .cost('{3}{U}')
    .types(CardType.SORCERY)
    .waterbend(3)
    .spellEffect(() => {})
    .build();
  const supportArtifact = makeVanillaArtifact('Water Drum');
  const supportCreatureA = makeVanillaCreature('Canal Adept');
  const supportCreatureB = makeVanillaCreature('Tidal Student');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Water Commander', '{U}'),
        cards: [waterSpell, supportArtifact, supportCreatureA, supportCreatureB],
        playerName: 'Water Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Water Whip' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Water Drum' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Canal Adept' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Tidal Student' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Water Drum' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Canal Adept' }, { summoningSick: true })
        .setBattlefieldCard({ playerId: 'player1', name: 'Tidal Student' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'U', 1);

  const castAction = getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Water Whip').objectId,
  );

  await engine.submitAction(castAction);
  await settleEngine();

  assert.ok(graveyardNames(state, 'player1').includes('Water Whip'));
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Water Drum').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Canal Adept').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Tidal Student').tapped, true);
  assert.deepEqual(state.players.player1.manaPool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});

test('tap costs reserve the source permanent instead of letting it help pay waterbending-style ability costs', async () => {
  const waterEngine = CardBuilder.create('Water Engine')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(1, 4)
    .activated(
      {
        tap: true,
        mana: parseManaCost('{3}'),
        genericTapSubstitution: {
          amount: 3,
          filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' },
          ignoreSummoningSickness: true,
        },
      },
      (ctx) => {
        ctx.game.gainLife(ctx.controller, 1);
      },
      {
        timing: 'sorcery',
        description: 'Water Engine ability',
      },
    )
    .build();
  const supportA = makeVanillaArtifact('Support A');
  const supportB = makeVanillaCreature('Support B');
  const supportC = makeVanillaArtifact('Support C');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Ability Commander', '{U}'),
        cards: [waterEngine, supportA, supportB, supportC],
        playerName: 'Ability Player',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Water Engine' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support C' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Water Engine' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support B' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support C' }, { tapped: true, summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const sourceId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Water Engine').objectId;
  assert.equal(
    engine.getLegalActions('player1').some((action) =>
      action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === sourceId,
    ),
    false,
  );

  engine.untapPermanent(getCard(state, 'player1', Zone.BATTLEFIELD, 'Support C').objectId);

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === sourceId,
  ));
  await settleEngine();

  assert.equal(state.players.player1.life, 41);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Water Engine').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Support A').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Support B').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Support C').tapped, true);
});

test('airbending grants only the owner a normal-timing cast permission from exile', async () => {
  const skyBison = makeVanillaCreature('Sky Bison');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Air Player', '{U}'), cards: [], playerName: 'Air' },
      { commander: makeCommander('Bison Keeper', '{2}'), cards: [skyBison], playerName: 'Keeper' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player2', name: 'Sky Bison' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Sky Bison' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  const bisonId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Sky Bison').objectId;
  engine.airbendObject(bisonId, { mana: parseManaCost('{2}') }, 'player1');

  assert.ok(state.zones.player2.EXILE.some((card) => card.definition.name === 'Sky Bison'));
  assert.equal(
    engine.getLegalActions('player1').some((action) =>
      action.type === ActionType.CAST_SPELL && action.cardId === bisonId,
    ),
    false,
  );

  engine.addMana('player2', 'C', 2);
  assert.equal(
    engine.getLegalActions('player2').some((action) =>
      action.type === ActionType.CAST_SPELL && action.cardId === bisonId,
    ),
    false,
  );

  state.currentPhase = Phase.PRECOMBAT_MAIN;
  state.currentStep = Step.MAIN;
  state.priorityPlayer = 'player2';
  state.passedPriority = new Set();

  const castAction = getLegalAction(
    engine,
    'player2',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === bisonId,
  );
  assert.equal(castAction.castMethod, 'cast-permission:airbend');

  await engine.submitAction(castAction);
  await settleEngine();

  assert.ok(state.zones.player2.BATTLEFIELD.some((card) => card.definition.name === 'Sky Bison'));
  assert.equal(state.zones.player2.EXILE.some((card) => card.definition.name === 'Sky Bison'), false);
});

test('airbending can exile a spell from the stack and let its owner recast it later', async () => {
  const stackSpell = CardBuilder.create('Stack Lesson')
    .cost('{1}')
    .types(CardType.SORCERY)
    .spellEffect(() => {})
    .build();
  const heldResponse = CardBuilder.create('Held Response')
    .cost('{U}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Air Responder', '{U}'), cards: [heldResponse], playerName: 'Responder' },
      { commander: makeCommander('Spell Caster', '{1}'), cards: [stackSpell], playerName: 'Caster' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Held Response' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Stack Lesson' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  const stackSpellId = getCard(state, 'player2', Zone.HAND, 'Stack Lesson').objectId;
  engine.addMana('player2', 'C', 1);
  engine.addMana('player1', 'U', 1);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player2',
    cardId: stackSpellId,
  });
  await settleEngine();

  assert.equal(state.stack.length, 1);
  engine.airbendObject(stackSpellId, { mana: parseManaCost('{2}') }, 'player1');

  assert.equal(state.stack.length, 0);
  assert.ok(state.zones.player2.EXILE.some((card) => card.definition.name === 'Stack Lesson'));

  state.players.player1.manaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
  state.currentPhase = Phase.PRECOMBAT_MAIN;
  state.currentStep = Step.MAIN;
  state.priorityPlayer = 'player2';
  state.passedPriority = new Set();
  engine.addMana('player2', 'C', 2);

  await engine.submitAction(getLegalAction(
    engine,
    'player2',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === stackSpellId,
  ));
  await settleEngine();

  assert.ok(graveyardNames(state, 'player2').includes('Stack Lesson'));
});

test('airbending leaves lands uncastable and tokens do not keep cast permissions', async () => {
  const practiceGround = makeBasicLand('Practice Ground', 'Island', 'U');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Air Player', '{U}'), cards: [], playerName: 'Air' },
      { commander: makeCommander('Land Keeper', '{2}'), cards: [practiceGround], playerName: 'Keeper' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player2', name: 'Practice Ground' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Practice Ground' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  const landId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Practice Ground').objectId;
  engine.airbendObject(landId, { mana: parseManaCost('{2}') }, 'player1');
  engine.addMana('player2', 'C', 2);

  assert.equal(
    engine.getLegalActions('player2').some((action) =>
      action.type === ActionType.CAST_SPELL && action.cardId === landId,
    ),
    false,
  );

  const token = engine.createToken('player2', {
    name: 'Token Hawk',
    types: [CardType.CREATURE],
    power: 1,
    toughness: 1,
    keywords: [],
    abilities: [],
    subtypes: ['Bird'],
  });
  engine.airbendObject(token.objectId, { mana: parseManaCost('{2}') }, 'player1');

  assert.equal(engine.getCard(token.objectId), undefined);
  assert.equal(state.castPermissions.some((permission) => permission.objectId === token.objectId), false);
});

test('earthbending animates a land with haste and returns it tapped after it dies', async () => {
  const practiceField = makeBasicLand('Practice Field', 'Island', 'U');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Earth Player', '{G}'), cards: [practiceField], playerName: 'Earth' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Practice Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Practice Field' }, { summoningSick: true })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const land = getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Field');
  const originalZoneChangeCounter = land.zoneChangeCounter;
  engine.earthbendLand(land.objectId, 4, 'player1');

  const earthbentLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Field');
  assert.equal(hasType(earthbentLand, CardType.LAND), true);
  assert.equal(hasType(earthbentLand, CardType.CREATURE), true);
  assert.equal(earthbentLand.modifiedPower, 4);
  assert.equal(earthbentLand.modifiedToughness, 4);
  assert.ok((earthbentLand.modifiedKeywords ?? []).includes('Haste'));

  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.DECLARE_ATTACKERS;
  state.priorityPlayer = 'player1';
  state.passedPriority = new Set();

  assert.equal(
    engine.getLegalActions('player1').some((action) => action.type === ActionType.DECLARE_ATTACKERS),
    true,
  );

  engine.destroyPermanent(land.objectId);
  await runLoop(engine);

  const returnedLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Field');
  assert.equal(returnedLand.tapped, true);
  assert.ok(returnedLand.zoneChangeCounter > originalZoneChangeCounter);
  assert.equal(hasType(returnedLand, CardType.CREATURE), false);
  assert.equal(graveyardNames(state, 'player1').includes('Practice Field'), false);
});

test('Badgermole Cub adds {G} as an immediate triggered mana ability when you tap a creature for mana', async () => {
  const badgermoleCub = makeBadgermoleCub();
  const manaDork = makeCreatureManaDork('Tunnel Tender', 'G');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Earth Commander', '{G}'), cards: [badgermoleCub, manaDork], playerName: 'Earth' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Badgermole Cub' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Tunnel Tender' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Badgermole Cub' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Tunnel Tender' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === getCard(state, 'player1', Zone.BATTLEFIELD, 'Tunnel Tender').objectId,
  ));
  await settleEngine();

  assert.equal(state.players.player1.manaPool.G, 2);
  assert.equal(state.stack.length, 0);
});

test('Badgermole Cub mana is included in autotap affordability for normal cast actions', async () => {
  const badgermoleCub = makeBadgermoleCub();
  const manaDork = makeCreatureManaDork('Tunnel Tender', 'G');
  const forest = makeBasicLand('Badger Forest', 'Forest', 'G');
  const expensiveSpell = CardBuilder.create('Badger Lesson')
    .cost('{2}{G}')
    .types(CardType.SORCERY)
    .spellEffect(() => {})
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Earth Commander', '{G}'),
        cards: [badgermoleCub, manaDork, forest, expensiveSpell],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Badgermole Cub' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Tunnel Tender' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Badger Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Badger Lesson' }, Zone.HAND)
        .setBattlefieldCard({ playerId: 'player1', name: 'Badgermole Cub' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Tunnel Tender' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Badger Forest' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const castAction = getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Badger Lesson').objectId,
  );

  await engine.submitAction(castAction);
  await settleEngine();

  assert.ok(graveyardNames(state, 'player1').includes('Badger Lesson'));
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Tunnel Tender').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Badger Forest').tapped, true);
  assert.deepEqual(state.players.player1.manaPool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});
