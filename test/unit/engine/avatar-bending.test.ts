import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { AnimalAttendant, AvatarKyoshiEarthbender, BadgermoleCub, BumiEclecticEarthbender, BumiUnleashed, EarthKingdomGeneral } from '../../../src/cards/sets/starter/creatures.ts';
import { BaSingSe, Forest } from '../../../src/cards/sets/starter/lands.ts';
import { hasAbilityDescription } from '../../../src/engine/AbilityPrimitives.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone, parseManaCost } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, makeCommander, makeTargetedCreatureRemoval, settleEngine } from './helpers.ts';

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

async function runLoop(engine: ReturnType<typeof createHarness>['engine']) {
  await (engine as unknown as { runGameLoop(): Promise<void> }).runGameLoop();
  await settleEngine();
}

test('Animal Attendant spends its tracked mana on an eligible non-Human creature and adds an ETB counter', async () => {
  const nonHumanCreature = CardBuilder.create('Sky Bison Pup')
    .cost('{G}')
    .types(CardType.CREATURE)
    .subtypes('Bison')
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Earth Commander', '{G}'),
        cards: [AnimalAttendant, nonHumanCreature],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Animal Attendant' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Sky Bison Pup' }, Zone.HAND)
        .setBattlefieldCard({ playerId: 'player1', name: 'Animal Attendant' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const action = getLegalAction(engine, 'player1', (candidate) =>
    candidate.type === ActionType.CAST_SPELL && candidate.cardId === getCard(state, 'player1', Zone.HAND, 'Sky Bison Pup').objectId,
  );
  await engine.submitAction(action);
  await settleEngine();

  const creature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Sky Bison Pup');
  assert.equal(creature.counters['+1/+1'], 1);
  assert.equal(state.players.player1.manaPool.G, 0);
});

test('Avatar Kyoshi only has hexproof during its controller turn', async () => {
  const removal = makeTargetedCreatureRemoval('Pinpoint Light', '{W}');
  const kyoshiFiller = makeVanillaCreature('Kyoshi Guard');
  const removalFiller = makeVanillaCreature('Removal Guard');
  const p3Filler = makeVanillaCreature('P3 Guard');
  const p4Filler = makeVanillaCreature('P4 Guard');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Kyoshi Commander', '{G}'),
        cards: [AvatarKyoshiEarthbender, kyoshiFiller],
        playerName: 'Kyoshi',
      },
      {
        commander: makeCommander('Removal Commander', '{W}'),
        cards: [removal, removalFiller],
        playerName: 'Removal',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [p3Filler], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [p4Filler], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Avatar Kyoshi, Earthbender' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Avatar Kyoshi, Earthbender' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Pinpoint Light' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player2', 'W', 1);
  const kyoshiId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Avatar Kyoshi, Earthbender').objectId;
  const pinlightId = getCard(state, 'player2', Zone.HAND, 'Pinpoint Light').objectId;

  const internalEngine = engine as unknown as {
    continuousEffects: { applyAll: (game: typeof state) => void };
    handleCastSpell: (
      playerId: 'player1' | 'player2' | 'player3' | 'player4',
      cardId: string,
      targets?: (string | 'player1' | 'player2' | 'player3' | 'player4')[],
    ) => Promise<void>;
    resolveTopOfStack: () => Promise<void>;
  };

  internalEngine.continuousEffects.applyAll(state);
  await internalEngine.handleCastSpell('player2', pinlightId, [kyoshiId]);

  assert.equal(state.stack.length, 0);
  assert.equal(state.zones.player2.HAND.some((card) => card.definition.name === 'Pinpoint Light'), true);
  assert.equal(graveyardNames(state, 'player1').includes('Avatar Kyoshi, Earthbender'), false);

  state.activePlayer = 'player2';
  state.currentPhase = Phase.PRECOMBAT_MAIN;
  state.currentStep = Step.MAIN;
  state.priorityPlayer = 'player2';
  state.passedPriority = new Set();

  internalEngine.continuousEffects.applyAll(state);
  await internalEngine.handleCastSpell('player2', pinlightId, [kyoshiId]);
  assert.equal(state.stack.length, 1);
  await internalEngine.resolveTopOfStack();

  assert.ok(graveyardNames(state, 'player1').includes('Avatar Kyoshi, Earthbender'));
});

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

test('Avatar Kyoshi earthbends a land at the beginning of combat on your turn and untaps it', async () => {
  const tappedLand = makeBasicLand('Kyoshi Field', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Kyoshi Commander', '{G}'),
        cards: [AvatarKyoshiEarthbender, tappedLand],
        playerName: 'Kyoshi',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Avatar Kyoshi, Earthbender' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Kyoshi Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Avatar Kyoshi, Earthbender' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Kyoshi Field' }, { tapped: true, summoningSick: false })
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
    continuousEffects: { applyAll: (game: typeof state) => void };
    turnManager: { advanceStep: (game: typeof state) => void };
  };

  internalEngine.continuousEffects.applyAll(state);
  internalEngine.turnManager.advanceStep(state);
  await runLoop(engine);

  const land = getCard(state, 'player1', Zone.BATTLEFIELD, 'Kyoshi Field');
  assert.equal(hasType(land, CardType.LAND), true);
  assert.equal(hasType(land, CardType.CREATURE), true);
  assert.equal(land.counters['+1/+1'], 8);
  assert.equal(land.modifiedPower, 8);
  assert.equal(land.modifiedToughness, 8);
  assert.ok(hasAbilityDescription(land, 'Haste'));
  assert.equal(land.tapped, false);
});

test('Bumi, Eclectic Earthbender earthbends a land on entry and returns it tapped after it dies', async () => {
  const practiceLand = makeBasicLand('Bumi Field', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{G}'),
        cards: [BumiEclecticEarthbender, practiceLand],
        playerName: 'Bumi',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bumi, Eclectic Earthbender' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Bumi Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Bumi Field' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 5);

  const bumiId = getCard(state, 'player1', Zone.HAND, 'Bumi, Eclectic Earthbender').objectId;
  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === bumiId,
  ));
  await settleEngine();

  const earthbentLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi Field');
  const originalZoneChangeCounter = earthbentLand.zoneChangeCounter;
  assert.equal(hasType(earthbentLand, CardType.CREATURE), true);
  assert.equal(earthbentLand.counters['+1/+1'], 1);
  assert.equal(earthbentLand.modifiedPower, 1);
  assert.equal(earthbentLand.modifiedToughness, 1);
  assert.ok(hasAbilityDescription(earthbentLand, 'Haste'));
  assert.equal(earthbentLand.tapped, false);

  engine.destroyPermanent(earthbentLand.objectId);
  await runLoop(engine);

  const returnedLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi Field');
  assert.equal(returnedLand.tapped, true);
  assert.ok(returnedLand.zoneChangeCounter > originalZoneChangeCounter);
  assert.equal(hasType(returnedLand, CardType.CREATURE), false);
  assert.equal(graveyardNames(state, 'player1').includes('Bumi Field'), false);
});

test('Bumi, Eclectic Earthbender puts two +1/+1 counters on each land creature you control when it attacks', async () => {
  const alliedLandCard = makeBasicLand('Bumi Grove A', 'Forest', 'G');
  const alliedPlainLandCard = makeBasicLand('Bumi Grove C', 'Forest', 'G');
  const enemyLandCard = makeBasicLand('Bumi Grove B', 'Forest', 'G');
  const enemyPlainLandCard = makeBasicLand('Bumi Grove D', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{G}'),
        cards: [BumiEclecticEarthbender, alliedLandCard, alliedPlainLandCard],
        playerName: 'Bumi',
      },
      {
        commander: makeCommander('P2 Commander', '{2}'),
        cards: [enemyLandCard, enemyPlainLandCard],
        playerName: 'P2',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bumi, Eclectic Earthbender' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Bumi Grove A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Bumi Grove C' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Bumi Grove B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Bumi Grove D' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Bumi, Eclectic Earthbender' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Bumi Grove A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Bumi Grove C' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Bumi Grove B' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Bumi Grove D' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map(),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const alliedLandId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi Grove A').objectId;
  const enemyLandId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Bumi Grove B').objectId;

  engine.earthbendLand(alliedLandId, 1, 'player1');
  engine.earthbendLand(enemyLandId, 1, 'player2');
  await settleEngine();

  const bumiId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi, Eclectic Earthbender').objectId;
  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.DECLARE_ATTACKERS,
    ),
    type: ActionType.DECLARE_ATTACKERS,
    playerId: 'player1',
    attackers: [{
      attackerId: bumiId,
      defender: { type: 'player', id: 'player2' },
    }],
  });
  const internalEngine = engine as unknown as {
    resolveTopOfStack: () => Promise<void>;
  };
  await runLoop(engine);
  await internalEngine.resolveTopOfStack();
  await settleEngine();

  assert.equal(
    state.eventLog.some((event) => event.type === 'ATTACKS' && event.attackerId === bumiId),
    true,
  );

  const alliedLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi Grove A');
  const alliedPlainLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi Grove C');
  const enemyLandCreature = getCard(state, 'player2', Zone.BATTLEFIELD, 'Bumi Grove B');
  const enemyPlainLand = getCard(state, 'player2', Zone.BATTLEFIELD, 'Bumi Grove D');

  assert.equal(hasType(alliedLand, CardType.CREATURE), true);
  assert.equal(hasType(enemyLandCreature, CardType.CREATURE), true);
  assert.equal(hasType(alliedPlainLand, CardType.CREATURE), false);
  assert.equal(hasType(enemyPlainLand, CardType.CREATURE), false);
  assert.equal(alliedLand.counters['+1/+1'], 3);
  assert.equal(enemyLandCreature.counters['+1/+1'], 1);
  assert.equal(alliedPlainLand.counters['+1/+1'], undefined);
  assert.equal(enemyPlainLand.counters['+1/+1'], undefined);
});

test('Earth Kingdom General earthbends 2 when it enters', async () => {
  const trainingLand = makeBasicLand('General Field', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('General Commander', '{G}'),
        cards: [EarthKingdomGeneral, trainingLand],
        playerName: 'General',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earth Kingdom General' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'General Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'General Field' }, { summoningSick: false })
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
  engine.addMana('player1', 'C', 3);

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Earth Kingdom General').objectId,
  ));
  await settleEngine();

  const earthbentLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'General Field');
  assert.equal(hasType(earthbentLand, CardType.CREATURE), true);
  assert.equal(earthbentLand.counters['+1/+1'], 2);
  assert.equal(earthbentLand.modifiedPower, 2);
  assert.equal(earthbentLand.modifiedToughness, 2);
  assert.ok(hasAbilityDescription(earthbentLand, 'Haste'));
});

test('Earth Kingdom General gains life once each turn from +1/+1 counters on creatures', async () => {
  const trainingLand = makeBasicLand('Counter Field', 'Forest', 'G');
  const counterTarget = makeVanillaCreature('Counter Target');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('General Commander', '{G}'),
        cards: [EarthKingdomGeneral, trainingLand, counterTarget],
        playerName: 'General',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earth Kingdom General' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Counter Target' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Counter Field' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Counter Target' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Counter Field' }, { summoningSick: false })
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
  engine.addMana('player1', 'C', 3);

  const internalEngine = engine as unknown as {
    handleCastSpell: (
      playerId: 'player1' | 'player2' | 'player3' | 'player4',
      cardId: string,
      targets?: (string | 'player1' | 'player2' | 'player3' | 'player4')[],
    ) => Promise<void>;
    placePendingTriggers: () => Promise<boolean>;
    resolveTopOfStack: () => Promise<void>;
  };

  await internalEngine.handleCastSpell(
    'player1',
    getCard(state, 'player1', Zone.HAND, 'Earth Kingdom General').objectId,
  );
  await internalEngine.resolveTopOfStack();
  assert.equal(await internalEngine.placePendingTriggers(), true);
  await internalEngine.resolveTopOfStack();
  assert.equal(await internalEngine.placePendingTriggers(), true);
  await internalEngine.resolveTopOfStack();
  await settleEngine();
  assert.equal(state.players.player1.life, 42);

  const target = getCard(state, 'player1', Zone.BATTLEFIELD, 'Counter Target');

  engine.addCounters(target.objectId, '+1/+1', 1, { player: 'player1' });
  assert.equal(await internalEngine.placePendingTriggers(), false);
  await settleEngine();
  assert.equal(state.players.player1.life, 42);

  engine.addCounters(target.objectId, '+1/+1', 1, { player: 'player1' });
  assert.equal(await internalEngine.placePendingTriggers(), false);
  await settleEngine();
  assert.equal(state.players.player1.life, 42);

  state.turnNumber += 1;
  state.activePlayer = 'player1';
  state.currentPhase = Phase.PRECOMBAT_MAIN;
  state.currentStep = Step.MAIN;
  state.priorityPlayer = 'player1';
  state.passedPriority = new Set();
  state.triggeredAbilitiesUsedThisTurn = new Set<string>();

  engine.addCounters(target.objectId, '+1/+1', 1, { player: 'player1' });
  assert.equal(await internalEngine.placePendingTriggers(), true);
  await internalEngine.resolveTopOfStack();
  await settleEngine();
  assert.equal(state.players.player1.life, 43);
});

test('Bumi, Unleashed earthbends a land with four +1/+1 counters when it enters', async () => {
  const trainingLand = makeBasicLand('Unleashed Training Ground', 'Mountain', 'R');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{R}{G}'),
        cards: [BumiUnleashed, trainingLand],
        playerName: 'Bumi',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bumi, Unleashed' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Unleashed Training Ground' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Unleashed Training Ground' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'G', 1);
  engine.addMana('player1', 'C', 3);

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Bumi, Unleashed').objectId,
  ));
  await settleEngine();

  const earthbentLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Unleashed Training Ground');
  assert.equal(hasType(earthbentLand, CardType.CREATURE), true);
  assert.equal(earthbentLand.counters['+1/+1'], 4);
  assert.equal(earthbentLand.modifiedPower, 4);
  assert.equal(earthbentLand.modifiedToughness, 4);
  assert.ok(hasAbilityDescription(earthbentLand, 'Haste'));
});

test('Bumi, Unleashed queues an extra combat and restricts it to land creatures after combat damage to a player', async () => {
  const extraCombatLand = makeBasicLand('Unleashed Rampart', 'Mountain', 'R');
  const supportLand = makeBasicLand('Unleashed Wilds', 'Forest', 'G');
  const supportCreature = makeVanillaCreature('Support Fighter');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Bumi Commander', '{R}{G}'),
        cards: [BumiUnleashed, extraCombatLand, supportLand, supportCreature],
        playerName: 'Bumi',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Bumi, Unleashed' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Unleashed Rampart' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Unleashed Wilds' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Fighter' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Bumi, Unleashed' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Unleashed Rampart' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Unleashed Wilds' }, { tapped: true, summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Fighter' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map(),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const landCreatureId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Unleashed Rampart').objectId;
  engine.earthbendLand(landCreatureId, 1, 'player1');
  await settleEngine();

  const bumiId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Bumi, Unleashed').objectId;
  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.DECLARE_ATTACKERS,
    ),
    type: ActionType.DECLARE_ATTACKERS,
    playerId: 'player1',
    attackers: [{
      attackerId: bumiId,
      defender: { type: 'player', id: 'player2' },
    }],
  });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });

  assert.equal(state.currentPhase, Phase.COMBAT);
  assert.equal(state.currentStep, Step.DECLARE_ATTACKERS);
  assert.equal(
    state.eventLog.filter((event) => event.type === 'STEP_CHANGE' && event.step === Step.BEGINNING_OF_COMBAT).length,
    1,
  );
  assert.equal(state.players.player2.life, 35);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Unleashed Wilds').tapped, false);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Unleashed Rampart').tapped, false);

  const internalEngine = engine as unknown as {
    combatManager: { getValidAttackers: (game: typeof state) => Array<{ definition: { name: string } }> };
  };
  const validAttackers = internalEngine.combatManager.getValidAttackers(state).map((card) => card.definition.name).sort();
  assert.deepEqual(validAttackers, ['Unleashed Rampart']);
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
  assert.ok(hasAbilityDescription(earthbentLand, 'Haste'));

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

test('Ba Sing Se enters tapped if you do not control a basic land', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Ba Sing Se Commander', '{G}'),
        cards: [BaSingSe],
        playerName: 'Ba Sing Se',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Ba Sing Se' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const baSingSeId = getCard(state, 'player1', Zone.HAND, 'Ba Sing Se').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.PLAY_LAND && action.cardId === baSingSeId,
    ),
  );
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Ba Sing Se').tapped, true);
});

test('Ba Sing Se enters untapped if you already control a basic land', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Ba Sing Se Commander', '{G}'),
        cards: [BaSingSe, Forest],
        playerName: 'Ba Sing Se',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Forest' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Forest' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Ba Sing Se' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const baSingSeId = getCard(state, 'player1', Zone.HAND, 'Ba Sing Se').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.PLAY_LAND && action.cardId === baSingSeId,
    ),
  );
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Ba Sing Se').tapped, false);
});

test('Ba Sing Se earthbend ability works at sorcery speed', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Ba Sing Se Commander', '{G}'),
        cards: [BaSingSe, Forest],
        playerName: 'Ba Sing Se',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Ba Sing Se' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Forest' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Ba Sing Se' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Forest' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 3);

  const baSingSeId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Ba Sing Se').objectId;
  const forestId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest').objectId;
  assert.equal(
    engine.getLegalActions('player1').some(
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === baSingSeId &&
        action.abilityIndex === 1,
    ),
    true,
  );

  await engine.submitAction(
    {
      ...getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === baSingSeId &&
        action.abilityIndex === 1,
      ),
      targets: [forestId],
    },
  );
  await settleEngine();

  const earthbentLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest');
  assert.equal(hasType(earthbentLand, CardType.CREATURE), true);
  assert.equal(earthbentLand.counters['+1/+1'], 2);
  assert.equal(earthbentLand.modifiedPower, 2);
  assert.equal(earthbentLand.modifiedToughness, 2);
  assert.equal(earthbentLand.tapped, false);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Ba Sing Se').tapped, true);
});

test('Badgermole Cub adds {G} as an immediate triggered mana ability when you tap a creature for mana', async () => {
  const manaDork = makeCreatureManaDork('Tunnel Tender', 'G');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Earth Commander', '{G}'), cards: [BadgermoleCub, manaDork], playerName: 'Earth' },
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
        cards: [BadgermoleCub, manaDork, forest, expensiveSpell],
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

test('Animal Attendant stores a mana-carrying replacement effect that adds a +1/+1 counter to a non-Human creature', async () => {
  const nonHumanCreature = CardBuilder.create('River Beast')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .subtypes('Beast')
    .stats(2, 2)
    .build();
  const forest = makeBasicLand('River Forest', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('River Commander', '{G}'),
        cards: [AnimalAttendant, forest, nonHumanCreature],
        playerName: 'River',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Animal Attendant' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'River Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'River Beast' }, Zone.HAND)
        .setBattlefieldCard({ playerId: 'player1', name: 'Animal Attendant' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'River Forest' }, { summoningSick: false })
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
    (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === getCard(state, 'player1', Zone.BATTLEFIELD, 'Animal Attendant').objectId,
  ));
  await settleEngine();

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'River Beast').objectId,
  ));
  await settleEngine();

  const riverBeast = getCard(state, 'player1', Zone.BATTLEFIELD, 'River Beast');
  assert.equal(riverBeast.zone, Zone.BATTLEFIELD);
  assert.equal(riverBeast.counters['+1/+1'], 1);
  assert.equal(riverBeast.modifiedPower, 3);
  assert.equal(riverBeast.modifiedToughness, 3);
  assert.deepEqual(state.players.player1.manaPool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});

test('Animal Attendant does not add a counter when its mana is spent to cast a Human creature', async () => {
  const humanCreature = CardBuilder.create('River Soldier')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .subtypes('Human', 'Soldier')
    .stats(2, 2)
    .build();
  const forest = makeBasicLand('Human Forest', 'Forest', 'G');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Human Commander', '{G}'),
        cards: [AnimalAttendant, forest, humanCreature],
        playerName: 'Human',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Animal Attendant' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Human Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'River Soldier' }, Zone.HAND)
        .setBattlefieldCard({ playerId: 'player1', name: 'Animal Attendant' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Human Forest' }, { summoningSick: false })
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
    (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === getCard(state, 'player1', Zone.BATTLEFIELD, 'Animal Attendant').objectId,
  ));
  await settleEngine();

  await engine.submitAction(getLegalAction(
    engine,
    'player1',
    (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'River Soldier').objectId,
  ));
  await settleEngine();

  const riverSoldier = getCard(state, 'player1', Zone.BATTLEFIELD, 'River Soldier');
  assert.equal(riverSoldier.zone, Zone.BATTLEFIELD);
  assert.equal(riverSoldier.counters['+1/+1'], undefined);
  assert.equal(riverSoldier.modifiedPower, 2);
  assert.equal(riverSoldier.modifiedToughness, 2);
  assert.deepEqual(state.players.player1.manaPool, { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 });
});
