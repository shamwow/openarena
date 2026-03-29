import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { AangAtTheCrossroads } from '../../../src/cards/sets/TLA/aang-at-the-crossroads.ts';
import { AangSwiftSavior } from '../../../src/cards/sets/TLA/aang-swift-savior.ts';
import { AvatarAang } from '../../../src/cards/sets/TLA/avatar-aang.ts';
import { TheLegendOfKuruk } from '../../../src/cards/sets/TLA/the-legend-of-kuruk.ts';
import { TheRiseOfSozin } from '../../../src/cards/sets/TLA/the-rise-of-sozin.ts';
import { FireNationPalace, Mountain } from '../../../src/cards/sets/starter/lands.ts';
import { GameEventType, ActionType, CardType, Phase, Step, Zone, parseManaCost } from '../../../src/engine/types.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeVanillaCreature(name: string, cost = '{2}') {
  return CardBuilder.create(name)
    .cost(cost)
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

function makeWaterbendSpell(name: string) {
  return CardBuilder.create(name)
    .cost('{2}{U}')
    .types(CardType.SORCERY)
    .waterbend(2)
    .spellEffect(() => {})
    .build();
}

async function resolveTriggeredWork(engine: ReturnType<typeof createHarness>['engine'], state: ReturnType<typeof createHarness>['state']) {
  const internal = engine as unknown as {
    placePendingTriggers: () => Promise<boolean>;
    resolveTopOfStack: () => Promise<void>;
    continuousEffects: { applyAll: (game: typeof state) => void };
  };

  for (let i = 0; i < 10; i += 1) {
    let progressed = false;

    if (await internal.placePendingTriggers()) {
      progressed = true;
    }

    while (state.stack.length > 0) {
      await internal.resolveTopOfStack();
      await settleEngine();
      progressed = true;
      await internal.placePendingTriggers();
    }

    internal.continuousEffects.applyAll(state);

    if (!progressed) {
      break;
    }
  }
}

function emitStepChange(
  engine: ReturnType<typeof createHarness>['engine'],
  state: ReturnType<typeof createHarness>['state'],
  phase: Phase,
  step: Step,
  activePlayer: 'player1' | 'player2' | 'player3' | 'player4',
) {
  state.currentPhase = phase;
  state.currentStep = step;
  state.activePlayer = activePlayer;

  const event = {
    type: GameEventType.STEP_CHANGE,
    timestamp: state.timestampCounter++,
    phase,
    step,
    activePlayer,
  } as const;

  state.eventLog.push(event);

  const internal = engine as unknown as {
    eventBus: {
      emit: (event: typeof event) => void;
      checkTriggers: (event: typeof event, game: typeof state) => typeof state.pendingTriggers;
    };
  };

  internal.eventBus.emit(event);
  state.pendingTriggers.push(...internal.eventBus.checkTriggers(event, state));
}

function recordTurnStartMarker(
  engine: ReturnType<typeof createHarness>['engine'],
  state: ReturnType<typeof createHarness>['state'],
  activePlayer: 'player1' | 'player2' | 'player3' | 'player4',
) {
  const event = {
    type: GameEventType.TURN_START,
    timestamp: state.timestampCounter++,
    activePlayer,
    turnNumber: state.turnNumber + 1,
  } as const;

  state.eventLog.push(event);

  const internal = engine as unknown as {
    eventBus: { emit: (event: typeof event) => void };
  };
  internal.eventBus.emit(event);
}

test('moving a saga to the battlefield transformed uses its back face and skips front-face lore setup', () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Kuruk Commander', '{2}{U}'),
        cards: [TheLegendOfKuruk],
        playerName: 'Kuruk',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder.moveCard({ playerId: 'player1', name: 'The Legend of Kuruk' }, Zone.EXILE);
    },
  });

  const cardId = getCard(state, 'player1', Zone.EXILE, 'The Legend of Kuruk').objectId;
  engine.moveCard(cardId, Zone.BATTLEFIELD, 'player1', { transformed: true });

  const internal = engine as unknown as {
    continuousEffects: { applyAll: (game: typeof state) => void };
  };
  internal.continuousEffects.applyAll(state);

  const transformed = getCard(state, 'player1', Zone.BATTLEFIELD, 'The Legend of Kuruk');
  assert.equal(transformed.isTransformed, true);
  assert.equal(hasType(transformed, CardType.CREATURE), true);
  assert.equal(hasType(transformed, CardType.ENCHANTMENT), false);
  assert.equal(transformed.counters.lore ?? 0, 0);
  assert.equal(
    state.eventLog.some((event) =>
      event.type === GameEventType.COUNTER_ADDED &&
      event.objectId === cardId &&
      event.counterType === 'lore',
    ),
    false,
  );
});

test('waterbending cost substitution appends keyword-action log entries', async () => {
  const waterSpell = makeWaterbendSpell('Flow State');
  const supportArtifact = makeVanillaArtifact('Water Drum');
  const supportCreature = makeVanillaCreature('Canal Adept');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Water Commander', '{U}'),
        cards: [waterSpell, supportArtifact, supportCreature],
        playerName: 'Elemental',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Flow State' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Water Drum' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Canal Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Canal Adept' }, { summoningSick: false })
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
  const waterSpellId = getCard(state, 'player1', Zone.HAND, 'Flow State').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === waterSpellId,
    ),
  );
  await settleEngine();

  const actionNames = state.eventLog
    .filter((event) => event.type === GameEventType.ACTION_PERFORMED && event.player === 'player1')
    .map((event) => event.actionName);

  assert.ok(actionNames.includes('waterbend'));
});

test('airbend and earthbend append keyword-action log entries', () => {
  const basicLand = makeBasicLand('Training Grounds', 'Forest', 'G');
  const targetCreature = makeVanillaCreature('Sky Bison');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Elemental Commander', '{U}{G}'),
        cards: [basicLand],
        playerName: 'Elemental',
      },
      {
        commander: makeCommander('Target Commander', '{2}'),
        cards: [targetCreature],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Training Grounds' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Sky Bison' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Training Grounds' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Sky Bison' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const landId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Training Grounds').objectId;
  engine.earthbendLand(landId, 1, 'player1');

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Sky Bison').objectId;
  engine.airbendObject(targetId, { mana: parseManaCost('{2}') }, 'player1');

  const actionNames = state.eventLog
    .filter((event) => event.type === GameEventType.ACTION_PERFORMED && event.player === 'player1')
    .map((event) => event.actionName);

  assert.ok(actionNames.includes('earthbend'));
  assert.ok(actionNames.includes('airbend'));
});

test('firebending attack triggers append keyword-action log entries', async () => {
  const attacker = makeVanillaCreature('Palace Raider');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Fire Commander', '{R}'),
        cards: [FireNationPalace, Mountain, Mountain, attacker],
        playerName: 'Fire',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fire Nation Palace' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Mountain', nth: 0 }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Mountain', nth: 1 }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Palace Raider' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Palace Raider' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const palaceId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Fire Nation Palace').objectId;
  const attackerId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Palace Raider').objectId;

  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === palaceId &&
        action.abilityIndex === 1,
    ),
    targets: [attackerId],
  });
  await settleEngine();

  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.DECLARE_ATTACKERS;
  state.priorityPlayer = 'player1';
  state.passedPriority.clear();
  state.combat = {
    attackingPlayer: 'player1',
    attackers: new Map(),
    blockers: new Map(),
    blockerOrder: new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };

  await engine.submitAction({
    ...getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.DECLARE_ATTACKERS,
    ),
    attackers: [{
      attackerId,
      defender: { type: 'player', id: 'player2' },
    }],
  });
  await settleEngine();

  assert.ok(
    state.eventLog.some((event) =>
      event.type === GameEventType.ACTION_PERFORMED &&
      event.player === 'player1' &&
      event.actionName === 'firebend',
    ),
  );
});

test("Avatar Aang only counts keyword actions since the most recent turn-start marker", async () => {
  const fillers = Array.from({ length: 10 }, (_, index) => makeVanillaCreature(`Filler ${index + 1}`));

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Avatar Commander', '{U}{R}{G}{W}'),
        cards: [AvatarAang, ...fillers],
        playerName: 'Avatar',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Avatar Aang' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Avatar Aang' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const avatarId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Avatar Aang').objectId;
  const recordAction = async (actionName: 'airbend' | 'earthbend' | 'firebend' | 'waterbend') => {
    engine.recordActionPerformed('player1', 'keyword-action', actionName, avatarId);
    await resolveTriggeredWork(engine, state);
  };

  await recordAction('airbend');
  await recordAction('earthbend');
  await recordAction('firebend');
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Avatar Aang').isTransformed, undefined);

  recordTurnStartMarker(engine, state, 'player1');

  await recordAction('waterbend');
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Avatar Aang').isTransformed, undefined);

  await recordAction('airbend');
  await recordAction('earthbend');
  await recordAction('firebend');

  const transformed = getCard(state, 'player1', Zone.BATTLEFIELD, 'Avatar Aang');
  assert.equal(transformed.isTransformed, true);
});

test('Aang, Master of Elements applies its full WUBRG reduction to generic and hybrid costs', async () => {
  const genericSpell = CardBuilder.create('Elemental Mastery')
    .cost('{5}{W}')
    .types(CardType.SORCERY)
    .spellEffect(() => {})
    .build();
  const hybridSpell = CardBuilder.create('Unified Technique')
    .cost('{G/U}{2/U}{U/P}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();
  const supportLand = makeBasicLand('Sanctuary Fountain', 'Plains', 'W');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Avatar Commander', '{U}{R}{G}{W}'),
        cards: [AvatarAang, genericSpell, hybridSpell, supportLand],
        playerName: 'Avatar',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Avatar Aang' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Elemental Mastery' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Unified Technique' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Sanctuary Fountain' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Avatar Aang' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const avatarId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Avatar Aang').objectId;
  engine.transformPermanent(avatarId);
  (engine as unknown as { continuousEffects: { applyAll: (game: typeof state) => void } }).continuousEffects.applyAll(state);

  const genericSpellId = getCard(state, 'player1', Zone.HAND, 'Elemental Mastery').objectId;
  const hybridSpellId = getCard(state, 'player1', Zone.HAND, 'Unified Technique').objectId;
  const legalActions = engine.getLegalActions('player1');

  assert.ok(
    legalActions.some((action) => action.type === ActionType.CAST_SPELL && action.cardId === genericSpellId),
    'expected generic spillover to make {5}{W} castable with one land',
  );
  assert.ok(
    legalActions.some((action) => action.type === ActionType.CAST_SPELL && action.cardId === hybridSpellId),
    'expected hybrid-aware reduction to make {G/U}{2/U}{U/P} castable without mana',
  );

  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === hybridSpellId,
    ),
  );
  await settleEngine();

  assert.ok(graveyardNames(state, 'player1').includes('Unified Technique'));
  assert.equal(state.players.player1.life, 40);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Sanctuary Fountain').tapped, false);
});

test('Aang at the Crossroads transforms at the next upkeep after another creature you control leaves', async () => {
  const companion = makeVanillaCreature('Air Nomad Scout');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Aang Commander', '{G}{W}{U}'),
        cards: [AangAtTheCrossroads, companion],
        playerName: 'Aang',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Aang, at the Crossroads' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Air Nomad Scout' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Aang, at the Crossroads' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Air Nomad Scout' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const companionId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Air Nomad Scout').objectId;
  engine.destroyPermanent(companionId);
  await resolveTriggeredWork(engine, state);

  assert.equal(state.delayedTriggers.length, 1);

  emitStepChange(engine, state, Phase.BEGINNING, Step.UPKEEP, 'player2');
  await resolveTriggeredWork(engine, state);

  const aang = getCard(state, 'player1', Zone.BATTLEFIELD, 'Aang, at the Crossroads');
  assert.equal(aang.isTransformed, true);
});

test("Aang at the Crossroads does not transform if it isn't the same permanent on the next upkeep", async () => {
  const companion = makeVanillaCreature('Temple Guide');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Aang Commander', '{G}{W}{U}'),
        cards: [AangAtTheCrossroads, companion],
        playerName: 'Aang',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Aang, at the Crossroads' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Temple Guide' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Aang, at the Crossroads' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Temple Guide' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const companionId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Temple Guide').objectId;
  const aangId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Aang, at the Crossroads').objectId;

  engine.destroyPermanent(companionId);
  await resolveTriggeredWork(engine, state);
  assert.equal(state.delayedTriggers.length, 1);

  engine.moveCard(aangId, Zone.HAND, 'player1');
  engine.moveCard(aangId, Zone.BATTLEFIELD, 'player1');

  emitStepChange(engine, state, Phase.BEGINNING, Step.UPKEEP, 'player2');
  await resolveTriggeredWork(engine, state);

  const aang = getCard(state, 'player1', Zone.BATTLEFIELD, 'Aang, at the Crossroads');
  assert.equal(aang.isTransformed === true, false);
});

test('The Legend of Kuruk exiles itself and returns transformed on chapter III instead of being sacrificed as a Saga', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Kuruk Commander', '{2}{U}'),
        cards: [TheLegendOfKuruk],
        playerName: 'Kuruk',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'The Legend of Kuruk' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'The Legend of Kuruk' }, { counters: { lore: 2 } })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.BEGINNING,
          currentStep: Step.DRAW,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const internal = engine as unknown as {
    turnManager: { advanceStep: (game: typeof state) => void };
    continuousEffects: { applyAll: (game: typeof state) => void };
  };

  internal.turnManager.advanceStep(state);
  await resolveTriggeredWork(engine, state);
  internal.continuousEffects.applyAll(state);

  const returned = getCard(state, 'player1', Zone.BATTLEFIELD, 'The Legend of Kuruk');
  assert.equal(returned.isTransformed, true);
  assert.equal(hasType(returned, CardType.CREATURE), true);
  assert.equal(hasType(returned, CardType.ENCHANTMENT), false);
  assert.equal(returned.counters.lore ?? 0, 0);
  assert.equal(state.zones.player1.GRAVEYARD.some((card) => card.definition.name === 'The Legend of Kuruk'), false);
});

test('Fire Lord Sozin chooses an affordable X, autotaps mana sources, and reanimates within that budget', async () => {
  const swampA = makeBasicLand('Sozin Swamp A', 'Swamp', 'B');
  const swampB = makeBasicLand('Sozin Swamp B', 'Swamp', 'B');
  const swampC = makeBasicLand('Sozin Swamp C', 'Swamp', 'B');
  const graveyardCreatureA = makeVanillaCreature('Ashen Guardian', '{2}{B}');
  const graveyardCreatureB = makeVanillaCreature('Fallen Scout', '{1}{B}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Sozin Commander', '{4}{B}{B}'),
        cards: [TheRiseOfSozin, swampA, swampB, swampC],
        playerName: 'Sozin',
      },
      {
        commander: makeCommander('Defender Commander', '{2}'),
        cards: [graveyardCreatureA, graveyardCreatureB],
        playerName: 'Defender',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'The Rise of Sozin' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Sozin Swamp A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Sozin Swamp B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Sozin Swamp C' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Ashen Guardian' }, Zone.GRAVEYARD)
        .moveCard({ playerId: 'player2', name: 'Fallen Scout' }, Zone.GRAVEYARD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const sozinId = getCard(state, 'player1', Zone.BATTLEFIELD, 'The Rise of Sozin').objectId;
  engine.transformPermanent(sozinId);
  (engine as unknown as { continuousEffects: { applyAll: (game: typeof state) => void } }).continuousEffects.applyAll(state);
  engine.dealDamage(sozinId, 'player2', 5, true);
  await resolveTriggeredWork(engine, state);

  assert.ok(
    state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Ashen Guardian'),
    'expected the 3-mana-value creature to be reanimated for X=3',
  );
  assert.ok(graveyardNames(state, 'player2').includes('Fallen Scout'));
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Sozin Swamp A').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Sozin Swamp B').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Sozin Swamp C').tapped, true);
});

test('Fire Lord Sozin may choose fewer cards than X allows', async () => {
  const swampA = makeBasicLand('Reluctant Swamp A', 'Swamp', 'B');
  const swampB = makeBasicLand('Reluctant Swamp B', 'Swamp', 'B');
  const swampC = makeBasicLand('Reluctant Swamp C', 'Swamp', 'B');
  const swampD = makeBasicLand('Reluctant Swamp D', 'Swamp', 'B');
  const graveyardCreatureA = makeVanillaCreature('Captured Soldier', '{1}{B}');
  const graveyardCreatureB = makeVanillaCreature('Captured Scout', '{1}{B}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Sozin Commander', '{4}{B}{B}'),
        cards: [TheRiseOfSozin, swampA, swampB, swampC, swampD],
        playerName: 'Sozin',
      },
      {
        commander: makeCommander('Defender Commander', '{2}'),
        cards: [graveyardCreatureA, graveyardCreatureB],
        playerName: 'Defender',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    choiceResponder: (request) => {
      if (request.type === 'chooseYesNo') {
        request.resolve(request.prompt.includes('Choose another creature card?') ? false : true);
        return;
      }
      if (request.type === 'chooseOne' && request.prompt === 'Choose a value for X') {
        request.resolve(4);
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
    },
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'The Rise of Sozin' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Reluctant Swamp A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Reluctant Swamp B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Reluctant Swamp C' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Reluctant Swamp D' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Captured Soldier' }, Zone.GRAVEYARD)
        .moveCard({ playerId: 'player2', name: 'Captured Scout' }, Zone.GRAVEYARD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const sozinId = getCard(state, 'player1', Zone.BATTLEFIELD, 'The Rise of Sozin').objectId;
  engine.transformPermanent(sozinId);
  (engine as unknown as { continuousEffects: { applyAll: (game: typeof state) => void } }).continuousEffects.applyAll(state);
  engine.dealDamage(sozinId, 'player2', 5, true);
  await resolveTriggeredWork(engine, state);

  const returnedCaptives = state.zones.player1.BATTLEFIELD.filter((card) =>
    card.definition.name === 'Captured Soldier' || card.definition.name === 'Captured Scout',
  );
  const remainingCaptives = graveyardNames(state, 'player2').filter((name) =>
    name === 'Captured Soldier' || name === 'Captured Scout',
  );

  assert.equal(returnedCaptives.length, 1);
  assert.equal(remainingCaptives.length, 1);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Reluctant Swamp A').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Reluctant Swamp B').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Reluctant Swamp C').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Reluctant Swamp D').tapped, true);
});

test('Fire Lord Sozin does nothing if no positive X is affordable', async () => {
  const graveyardCreature = makeVanillaCreature('Unpaid Recruit', '{1}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Sozin Commander', '{4}{B}{B}'),
        cards: [TheRiseOfSozin],
        playerName: 'Sozin',
      },
      {
        commander: makeCommander('Defender Commander', '{2}'),
        cards: [graveyardCreature],
        playerName: 'Defender',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'The Rise of Sozin' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Unpaid Recruit' }, Zone.GRAVEYARD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const sozinId = getCard(state, 'player1', Zone.BATTLEFIELD, 'The Rise of Sozin').objectId;
  engine.transformPermanent(sozinId);
  (engine as unknown as { continuousEffects: { applyAll: (game: typeof state) => void } }).continuousEffects.applyAll(state);
  engine.dealDamage(sozinId, 'player2', 5, true);
  await resolveTriggeredWork(engine, state);

  assert.ok(graveyardNames(state, 'player2').includes('Unpaid Recruit'));
  assert.equal(
    state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Unpaid Recruit'),
    false,
  );
});

test('Aang, Swift Savior transforms through its waterbend activated ability', async () => {
  const supportArtifactA = makeVanillaArtifact('Support A');
  const supportArtifactB = makeVanillaArtifact('Support B');
  const supportArtifactC = makeVanillaArtifact('Support C');
  const supportArtifactD = makeVanillaArtifact('Support D');
  const supportCreatureA = makeVanillaCreature('Support Creature A');
  const supportCreatureB = makeVanillaCreature('Support Creature B');
  const supportCreatureC = makeVanillaCreature('Support Creature C');
  const supportCreatureD = makeVanillaCreature('Support Creature D');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Swift Commander', '{W}{U}'),
        cards: [
          AangSwiftSavior,
          supportArtifactA,
          supportArtifactB,
          supportArtifactC,
          supportArtifactD,
          supportCreatureA,
          supportCreatureB,
          supportCreatureC,
          supportCreatureD,
        ],
        playerName: 'Swift',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Aang, Swift Savior' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support C' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support D' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Creature A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Creature B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Creature C' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Creature D' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Aang, Swift Savior' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Creature A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Creature B' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Creature C' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Creature D' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const aangId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Aang, Swift Savior').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) =>
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === aangId,
    ),
  );
  await settleEngine();

  const transformed = getCard(state, 'player1', Zone.BATTLEFIELD, 'Aang, Swift Savior');
  assert.equal(transformed.isTransformed, true);
  assert.ok(
    state.eventLog.some((event) =>
      event.type === GameEventType.ACTION_PERFORMED &&
      event.player === 'player1' &&
      event.actionName === 'waterbend',
    ),
  );
});
