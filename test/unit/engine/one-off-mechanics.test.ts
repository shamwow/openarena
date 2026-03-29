import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { SozinsComet } from '../../../src/cards/sets/TLA/sozins-comet.ts';
import { CityscapeLeveler } from '../../../src/cards/sets/TLE/cityscape-leveler.ts';
import { IrohDragonOfTheWest } from '../../../src/cards/sets/TLE/iroh-dragon-of-the-west.ts';
import { MysticRemora } from '../../../src/cards/sets/TLE/mystic-remora.ts';
import { ShatteringSpree } from '../../../src/cards/sets/TLE/shattering-spree.ts';
import { UncleMusings } from '../../../src/cards/sets/TLE/uncles-musings.ts';
import { ActionType, CardType, GameEventType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { ChoiceRequest, GameEngineImpl } from '../../../src/engine/GameEngine.ts';
import { createHarness, getCard, getLegalAction, makeCommander, settleEngine } from './helpers.ts';

function makeVanillaCreature(name: string, power = 2, toughness = 2) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeVanillaArtifact(name: string, cost = '{1}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.ARTIFACT)
    .build();
}

function makeVanillaEnchantment(name: string, cost = '{2}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.ENCHANTMENT)
    .build();
}

function makeSimpleSorcery(name: string, cost = '{1}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.SORCERY)
    .spellEffect(() => {})
    .build();
}

async function resolveTriggeredWork(engine: GameEngineImpl, state: ReturnType<typeof createHarness>['state']) {
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

function createCombatState(attackingPlayer: 'player1' | 'player2' | 'player3' | 'player4') {
  return {
    attackingPlayer,
    attackers: new Map<string, { type: 'player'; id: 'player1' | 'player2' | 'player3' | 'player4' }>(),
    blockers: new Map<string, string[]>(),
    blockerOrder: new Map<string, string[]>(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };
}

function createDefaultResponder(overrides: (request: ChoiceRequest) => boolean): (request: ChoiceRequest) => void {
  return (request) => {
    if (overrides(request)) {
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

test('TLE Iroh uses mentor to put a +1/+1 counter on another attacking creature with lesser power', async () => {
  const supportAlly = makeVanillaCreature('Support Ally', 2, 2);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Iroh Commander', '{R}'),
        cards: [IrohDragonOfTheWest, supportAlly],
        playerName: 'Iroh',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Iroh, Dragon of the West' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Support Ally' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Iroh, Dragon of the West' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Support Ally' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          game.combat = createCombatState('player1');
        });
    },
  });

  const irohId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Iroh, Dragon of the West').objectId;
  const supportAllyId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Support Ally').objectId;

  await engine.submitAction({
    ...getLegalAction(engine, 'player1', (action) => action.type === ActionType.DECLARE_ATTACKERS),
    attackers: [
      { attackerId: irohId, defender: { type: 'player', id: 'player2' } },
      { attackerId: supportAllyId, defender: { type: 'player', id: 'player2' } },
    ],
  });
  await resolveTriggeredWork(engine, state);

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Support Ally').counters['+1/+1'], 1);
});

test('Mystic Remora cumulative upkeep can be paid and it draws when an opponent declines to pay', async () => {
  const opponentSpell = makeSimpleSorcery('Careless Study', '{1}');
  const drawFiller = makeSimpleSorcery('Spare Notes', '{1}');
  const followUpSpell = makeSimpleSorcery('Second Thought', '{0}');

  const { state, engine } = createHarness({
    choiceResponder: createDefaultResponder((request) => {
      if (request.type === 'chooseYesNo' && request.prompt.includes('Pay cumulative upkeep')) {
        request.resolve(true);
        return true;
      }
      if (request.type === 'chooseYesNo' && request.prompt.includes('prevent Mystic Remora')) {
        request.resolve(false);
        return true;
      }
      if (request.type === 'chooseYesNo' && request.prompt.includes('Draw a card?')) {
        request.resolve(true);
        return true;
      }
      return false;
    }),
    decks: [
      {
        commander: makeCommander('Remora Commander', '{U}'),
        cards: [MysticRemora, drawFiller],
        playerName: 'Remora',
      },
      {
        commander: makeCommander('Spell Commander', '{1}'),
        cards: [opponentSpell, followUpSpell],
        playerName: 'Spellcaster',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Mystic Remora' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Careless Study' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Second Thought' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.BEGINNING,
          currentStep: Step.UPKEEP,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'C', 1);
  const upkeepEvent = {
    type: GameEventType.STEP_CHANGE,
    timestamp: state.timestampCounter++,
    phase: Phase.BEGINNING,
    step: Step.UPKEEP,
    activePlayer: 'player1',
  } as const;
  state.eventLog.push(upkeepEvent);
  const eventBus = (engine as unknown as {
    eventBus: {
      emit: (event: typeof upkeepEvent) => void;
      checkTriggers: (event: typeof upkeepEvent, game: typeof state) => typeof state.pendingTriggers;
    };
  }).eventBus;
  eventBus.emit(upkeepEvent);
  state.pendingTriggers.push(...eventBus.checkTriggers(upkeepEvent, state));
  await resolveTriggeredWork(engine, state);

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Mystic Remora').counters.age, 1);

  engine.addMana('player2', 'C', 1);
  state.activePlayer = 'player2';
  state.currentPhase = Phase.PRECOMBAT_MAIN;
  state.currentStep = Step.MAIN;
  state.priorityPlayer = 'player2';
  state.passedPriority.clear();
  const spellId = getCard(state, 'player2', Zone.HAND, 'Careless Study').objectId;
  await engine.submitAction(
    getLegalAction(engine, 'player2', (action) => action.type === ActionType.CAST_SPELL && action.cardId === spellId),
  );
  await resolveTriggeredWork(engine, state);

  assert.equal(state.zones.player1.HAND.length, 1);
});

test('Shattering Spree replicate creates copies that can choose new targets', async () => {
  const artifactA = makeVanillaArtifact('Relic A');
  const artifactB = makeVanillaArtifact('Relic B');
  const artifactC = makeVanillaArtifact('Relic C');
  let targetSelection = 0;

  const { state, engine } = createHarness({
    choiceResponder: createDefaultResponder((request) => {
      if (request.type === 'chooseOne' && request.options.every((option) => typeof option === 'number')) {
        request.resolve(2);
        return true;
      }
      if (request.type === 'chooseYesNo' && request.prompt.includes('replicate copy')) {
        request.resolve(true);
        return true;
      }
      if ((request.type === 'chooseN' || request.type === 'chooseUpToN') && request.count === 1) {
        const options = request.options as Array<{ definition?: { name: string } }>;
        const desiredName = ['Relic A', 'Relic B', 'Relic C'][targetSelection] ?? 'Relic A';
        const match = options.find((option) => option.definition?.name === desiredName);
        if (match) {
          targetSelection += 1;
          request.resolve([match]);
          return true;
        }
      }
      return false;
    }),
    decks: [
      {
        commander: makeCommander('Replicate Commander', '{R}'),
        cards: [ShatteringSpree],
        playerName: 'Replicator',
      },
      {
        commander: makeCommander('Artifact Commander', '{2}'),
        cards: [artifactA, artifactB, artifactC],
        playerName: 'Artifacts',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Shattering Spree' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Relic A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Relic B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Relic C' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'R', 3);
  const spellId = getCard(state, 'player1', Zone.HAND, 'Shattering Spree').objectId;
  await engine.submitAction(
    getLegalAction(engine, 'player1', (action) => action.type === ActionType.CAST_SPELL && action.cardId === spellId),
  );
  await resolveTriggeredWork(engine, state);

  assert.equal(state.zones.player2.BATTLEFIELD.some((card) => card.definition.name === 'Relic A'), false);
  assert.equal(state.zones.player2.BATTLEFIELD.some((card) => card.definition.name === 'Relic B'), false);
  assert.equal(state.zones.player2.BATTLEFIELD.some((card) => card.definition.name === 'Relic C'), false);
});

test("Uncle's Musings uses converge colors spent to return permanent cards and exiles itself", async () => {
  const permanentA = makeVanillaArtifact('Workshop Relic');
  const permanentB = makeVanillaEnchantment('Old Wisdom');
  const permanentC = makeVanillaCreature('Veteran Guide');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Musings Commander', '{G}{U}{R}'),
        cards: [UncleMusings, permanentA, permanentB, permanentC],
        playerName: 'Musings',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: "Uncle's Musings" }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Workshop Relic' }, Zone.GRAVEYARD)
        .moveCard({ playerId: 'player1', name: 'Old Wisdom' }, Zone.GRAVEYARD)
        .moveCard({ playerId: 'player1', name: 'Veteran Guide' }, Zone.GRAVEYARD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 2);
  engine.addMana('player1', 'U', 1);
  engine.addMana('player1', 'R', 1);
  const spellId = getCard(state, 'player1', Zone.HAND, "Uncle's Musings").objectId;
  await engine.submitAction(
    getLegalAction(engine, 'player1', (action) => action.type === ActionType.CAST_SPELL && action.cardId === spellId),
  );
  await resolveTriggeredWork(engine, state);

  assert.equal(state.zones.player1.HAND.some((card) => card.definition.name === 'Workshop Relic'), true);
  assert.equal(state.zones.player1.HAND.some((card) => card.definition.name === 'Old Wisdom'), true);
  assert.equal(state.zones.player1.HAND.some((card) => card.definition.name === 'Veteran Guide'), true);
  assert.equal(state.zones.player1.EXILE.some((card) => card.definition.name === "Uncle's Musings"), true);
});

test("Sozin's Comet can be foretold face down and cast on a later turn", async () => {
  const attacker = makeVanillaCreature('Fire Disciple', 2, 2);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Sozin Commander', '{R}'),
        cards: [SozinsComet, attacker],
        playerName: 'Sozin',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: "Sozin's Comet" }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Fire Disciple' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Fire Disciple' }, { summoningSick: false })
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
  const cometHandId = getCard(state, 'player1', Zone.HAND, "Sozin's Comet").objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === cometHandId,
    ),
  );
  await resolveTriggeredWork(engine, state);

  const foretold = getCard(state, 'player1', Zone.EXILE, "Sozin's Comet");
  assert.equal(foretold.faceDown, true);
  assert.equal(
    engine.getLegalActions('player1').some(
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === foretold.objectId,
    ),
    false,
  );

  state.turnNumber = 2;
  state.activePlayer = 'player1';
  state.currentPhase = Phase.PRECOMBAT_MAIN;
  state.currentStep = Step.MAIN;
  state.priorityPlayer = 'player1';
  state.passedPriority.clear();

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'C', 2);
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === foretold.objectId,
    ),
  );
  await resolveTriggeredWork(engine, state);

  const attackerId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Fire Disciple').objectId;
  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.DECLARE_ATTACKERS;
  state.priorityPlayer = 'player1';
  state.passedPriority.clear();
  state.combat = createCombatState('player1');

  await engine.submitAction({
    ...getLegalAction(engine, 'player1', (action) => action.type === ActionType.DECLARE_ATTACKERS),
    attackers: [{ attackerId, defender: { type: 'player', id: 'player2' } }],
  });
  await resolveTriggeredWork(engine, state);

  assert.ok(
    state.eventLog.some(
      (event) => event.type === GameEventType.MANA_PRODUCED && event.player === 'player1' && event.amount === 5,
    ),
  );
});

test('Cityscape Leveler cast trigger destroys a target and creates a tapped Powerstone token', async () => {
  const targetPermanent = makeVanillaEnchantment('Target Stronghold', '{3}');
  const followUpSpell = makeSimpleSorcery('Aftershock Planning', '{0}');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Leveler Commander', '{8}'),
        cards: [CityscapeLeveler, followUpSpell],
        playerName: 'Leveler',
      },
      {
        commander: makeCommander('Target Commander', '{2}'),
        cards: [targetPermanent],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cityscape Leveler' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Aftershock Planning' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Target Stronghold' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'C', 8);
  const spellId = getCard(state, 'player1', Zone.HAND, 'Cityscape Leveler').objectId;
  await engine.submitAction(
    getLegalAction(engine, 'player1', (action) => action.type === ActionType.CAST_SPELL && action.cardId === spellId),
  );
  await resolveTriggeredWork(engine, state);

  assert.equal(state.zones.player2.BATTLEFIELD.some((card) => card.definition.name === 'Target Stronghold'), false);
  const powerstone = getCard(state, 'player2', Zone.BATTLEFIELD, 'Powerstone');
  assert.equal(powerstone.tapped, true);
  assert.equal(state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Cityscape Leveler'), true);
});

test('Powerstone mana can cast artifact spells but not nonartifact spells', () => {
  const simpleArtifact = makeVanillaArtifact('Workshop Prism');
  const simpleSorcery = makeSimpleSorcery('Village Lesson');

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Powerstone Commander', '{1}'),
        cards: [simpleArtifact, simpleSorcery],
        playerName: 'Powerstone',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Workshop Prism' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Village Lesson' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const powerstone = engine.createPredefinedToken('player1', 'Powerstone');
  engine.untapPermanent(powerstone.objectId);

  const artifactCardId = getCard(state, 'player1', Zone.HAND, 'Workshop Prism').objectId;
  const sorceryCardId = getCard(state, 'player1', Zone.HAND, 'Village Lesson').objectId;
  const legalActions = engine.getLegalActions('player1');

  assert.equal(
    legalActions.some((action) => action.type === ActionType.CAST_SPELL && action.cardId === sorceryCardId),
    false,
  );
  assert.equal(
    legalActions.some((action) => action.type === ActionType.CAST_SPELL && action.cardId === artifactCardId),
    true,
  );
});

test('Cityscape Leveler unearth exiles it instead of letting it die normally', async () => {
  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Unearth Commander', '{8}'),
        cards: [CityscapeLeveler],
        playerName: 'Unearth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cityscape Leveler' }, Zone.GRAVEYARD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'C', 8);
  const graveyardId = getCard(state, 'player1', Zone.GRAVEYARD, 'Cityscape Leveler').objectId;
  await engine.submitAction(
    getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === graveyardId,
    ),
  );
  await resolveTriggeredWork(engine, state);

  const leveler = getCard(state, 'player1', Zone.BATTLEFIELD, 'Cityscape Leveler');
  engine.destroyPermanent(leveler.objectId);

  assert.equal(state.zones.player1.GRAVEYARD.some((card) => card.definition.name === 'Cityscape Leveler'), false);
  assert.equal(state.zones.player1.EXILE.some((card) => card.definition.name === 'Cityscape Leveler'), true);
});
