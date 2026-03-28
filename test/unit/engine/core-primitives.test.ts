import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ActionType, CardType, Phase, Step, Zone, type CardInstance, type GameState } from '../../../src/engine/types.ts';
import {
  battlefieldNames,
  createHarness,
  getCard,
  graveyardNames,
  makeCommander,
} from './helpers.ts';

function createCombatState(state: GameState, attacker: CardInstance, blocker?: CardInstance) {
  state.combat = {
    attackingPlayer: attacker.controller,
    attackers: new Map([[attacker.objectId, { type: 'player', id: blocker?.controller ?? 'player2' }]]),
    blockers: blocker ? new Map([[blocker.objectId, attacker.objectId]]) : new Map(),
    blockerOrder: blocker ? new Map([[attacker.objectId, [blocker.objectId]]]) : new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };
}

test('timing-permission lets a non-instant spell be cast at instant speed', () => {
  const ambusher = CardBuilder.create('Primitive Ambusher')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .staticAbility({
      type: 'timing-permission',
      scope: 'spell',
      anyTimeCouldCastInstant: true,
    }, { description: 'You may cast this spell as though it had flash.' })
    .build();
  const forestA = CardBuilder.create('Primitive Forest A')
    .types(CardType.LAND)
    .subtypes('Forest')
    .tapForMana('G')
    .build();
  const forestB = CardBuilder.create('Primitive Forest B')
    .types(CardType.LAND)
    .subtypes('Forest')
    .tapForMana('G')
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{G}'), cards: [ambusher, forestA, forestB], playerName: 'Primitive' },
      { commander: makeCommander('Turn Owner', '{W}'), cards: [], playerName: 'Opponent' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Primitive Ambusher' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Primitive Forest A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Primitive Forest B' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Primitive Forest A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Primitive Forest B' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.BEGINNING,
          currentStep: Step.UPKEEP,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const ambusherCard = getCard(state, 'player1', Zone.HAND, 'Primitive Ambusher');
  assert.ok(engine.getLegalActions('player1').some((action) =>
    action.type === ActionType.CAST_SPELL && action.cardId === ambusherCard.objectId,
  ));
});

test('timing-permission lets a sorcery-speed activated ability be used at instant speed', () => {
  const tactician = CardBuilder.create('Reactive Tactician')
    .cost('{1}{U}')
    .types(CardType.CREATURE)
    .stats(1, 3)
    .staticAbility({
      type: 'timing-permission',
      scope: 'activated-ability',
      anyTimeCouldCastInstant: true,
    }, { description: 'You may activate this creature as though you could cast an instant.' })
    .activated({}, () => undefined, {
      timing: 'sorcery',
      description: 'Sorcery-speed primitive ability.',
    })
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{U}'), cards: [tactician], playerName: 'Primitive' },
      { commander: makeCommander('Turn Owner', '{W}'), cards: [], playerName: 'Opponent' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Reactive Tactician' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Reactive Tactician' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.BEGINNING,
          currentStep: Step.UPKEEP,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const tacticianCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Reactive Tactician');
  assert.ok(engine.getLegalActions('player1').some((action) =>
    action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === tacticianCard.objectId,
  ));
});

test('activation-rule lets tap abilities ignore summoning sickness', () => {
  const apprentice = CardBuilder.create('Fresh Apprentice')
    .cost('{G}')
    .types(CardType.CREATURE)
    .stats(1, 1)
    .staticAbility({
      type: 'activation-rule',
      ignoreTapSummoningSickness: true,
    }, { description: 'This creature may use tap abilities immediately.' })
    .activated({ tap: true }, () => undefined, {
      description: '{T}: Do the thing.',
    })
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{G}'), cards: [apprentice], playerName: 'Primitive' },
      { commander: makeCommander('Opponent Commander', '{W}'), cards: [], playerName: 'Opponent' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Fresh Apprentice' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Fresh Apprentice' }, { summoningSick: true })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const apprenticeCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Fresh Apprentice');
  assert.ok(engine.getLegalActions('player1').some((action) =>
    action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === apprenticeCard.objectId,
  ));
});

test('block-rule handles flying or reach style evasion and landwalk', () => {
  const skyStalker = CardBuilder.create('Sky Stalker')
    .cost('{2}{U}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .staticAbility({
      type: 'block-rule',
      evasion: 'requires-flying-or-reach',
    }, { description: 'Flying-style block restriction.' })
    .build();
  const watchtower = CardBuilder.create('Watchtower Archer')
    .cost('{2}{G}')
    .types(CardType.CREATURE)
    .stats(2, 3)
    .staticAbility({
      type: 'block-rule',
      canBlockIfAttackerHas: 'flying',
    }, { description: 'Reach-style blocking permission.' })
    .build();
  const groundling = CardBuilder.create('Groundling')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
  const islandwalker = CardBuilder.create('River Sneak')
    .cost('{2}{U}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .staticAbility({
      type: 'block-rule',
      landwalkSubtypes: ['Island'],
    }, { description: 'Islandwalk-style evasion.' })
    .build();
  const island = CardBuilder.create('Blocking Island')
    .types(CardType.LAND)
    .subtypes('Island')
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{U}'), cards: [skyStalker, islandwalker], playerName: 'Attacker' },
      { commander: makeCommander('Defender Commander', '{G}'), cards: [watchtower, groundling, island], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Sky Stalker' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'River Sneak' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Watchtower Archer' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Groundling' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Blocking Island' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Sky Stalker' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'River Sneak' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Watchtower Archer' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Groundling' }, { summoningSick: false });
    },
  });

  const internal = engine as unknown as {
    combatManager: {
      canBlock: (blocker: CardInstance, attacker: CardInstance, game: GameState) => boolean;
    };
  };

  const skyStalkerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Sky Stalker');
  const islandwalkerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'River Sneak');
  const watchtowerCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Watchtower Archer');
  const groundlingCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Groundling');

  assert.equal(internal.combatManager.canBlock(groundlingCard, skyStalkerCard, state), false);
  assert.equal(internal.combatManager.canBlock(watchtowerCard, skyStalkerCard, state), true);
  assert.equal(internal.combatManager.canBlock(groundlingCard, islandwalkerCard, state), false);
});

test('block-rule enforces a minimum blocker count', () => {
  const menaceLike = CardBuilder.create('Coordinated Threat')
    .cost('{2}{R}')
    .types(CardType.CREATURE)
    .stats(3, 3)
    .staticAbility({
      type: 'block-rule',
      minBlockers: 2,
    }, { description: 'This creature needs two blockers.' })
    .build();
  const singleBlocker = CardBuilder.create('Solo Guard')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{R}'), cards: [menaceLike], playerName: 'Attacker' },
      { commander: makeCommander('Defender Commander', '{W}'), cards: [singleBlocker], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Coordinated Threat' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Solo Guard' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Coordinated Threat' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Solo Guard' }, { summoningSick: false });
    },
  });

  const internal = engine as unknown as {
    combatManager: {
      declareBlockers: (game: GameState, declarations: Array<{ blockerId: string; attackerId: string }>) => boolean;
    };
  };
  const attacker = getCard(state, 'player1', Zone.BATTLEFIELD, 'Coordinated Threat');
  const blocker = getCard(state, 'player2', Zone.BATTLEFIELD, 'Solo Guard');
  createCombatState(state, attacker);

  internal.combatManager.declareBlockers(state, [{ blockerId: blocker.objectId, attackerId: attacker.objectId }]);

  assert.equal(state.combat?.blockers.size ?? 0, 0);
});

test('combat-damage-rule handles first strike and deathtouch-style lethality', () => {
  const assassin = CardBuilder.create('Needle Duelist')
    .cost('{1}{B}')
    .types(CardType.CREATURE)
    .stats(1, 1)
    .staticAbility({
      type: 'combat-damage-rule',
      combatDamageStep: 'first-strike',
      lethalDamageIsOne: true,
      marksDeathtouchDamage: true,
    }, { description: 'First-strike deathtouch primitive package.' })
    .build();
  const brute = CardBuilder.create('Training Brute')
    .cost('{3}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{B}'), cards: [assassin], playerName: 'Attacker' },
      { commander: makeCommander('Defender Commander', '{W}'), cards: [brute], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Needle Duelist' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Training Brute' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Needle Duelist' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Training Brute' }, { summoningSick: false });
    },
  });

  const internal = engine as unknown as {
    combatManager: {
      dealCombatDamage: (game: GameState, isFirstStrike: boolean) => void;
    };
    sbaChecker: {
      checkAndApply: (game: GameState) => boolean;
    };
  };
  const attacker = getCard(state, 'player1', Zone.BATTLEFIELD, 'Needle Duelist');
  const blocker = getCard(state, 'player2', Zone.BATTLEFIELD, 'Training Brute');
  createCombatState(state, attacker, blocker);

  internal.combatManager.dealCombatDamage(state, true);
  while (internal.sbaChecker.checkAndApply(state)) {
    continue;
  }

  assert.ok(graveyardNames(state, 'player2').includes('Training Brute'));
  assert.ok(battlefieldNames(state, 'player1').includes('Needle Duelist'));
});

test('combat-damage-rule handles trample-style excess damage and lifelink-style life gain', () => {
  const trampler = CardBuilder.create('Overflow Behemoth')
    .cost('{3}{G}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .staticAbility({
      type: 'combat-damage-rule',
      excessToDefender: true,
      controllerGainsLifeFromDamage: true,
    }, { description: 'Trample and lifelink primitive package.' })
    .build();
  const blocker = CardBuilder.create('Token Wall')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{G}'), cards: [trampler], playerName: 'Attacker' },
      { commander: makeCommander('Defender Commander', '{W}'), cards: [blocker], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Overflow Behemoth' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Token Wall' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Overflow Behemoth' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Token Wall' }, { summoningSick: false });
    },
  });

  const internal = engine as unknown as {
    combatManager: {
      dealCombatDamage: (game: GameState, isFirstStrike: boolean) => void;
    };
  };
  const attacker = getCard(state, 'player1', Zone.BATTLEFIELD, 'Overflow Behemoth');
  const defendingBlocker = getCard(state, 'player2', Zone.BATTLEFIELD, 'Token Wall');
  createCombatState(state, attacker, defendingBlocker);

  internal.combatManager.dealCombatDamage(state, false);

  assert.equal(state.players.player2.life, 38);
  assert.equal(state.players.player1.life, 44);
});

test('survival-rule ignores destroy effects and lethal damage', () => {
  const immortal = CardBuilder.create('Stoneform Sentinel')
    .cost('{2}{W}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .staticAbility({
      type: 'survival-rule',
      ignoreDestroy: true,
      ignoreLethalDamage: true,
    }, { description: 'Indestructible-style survival rule.' })
    .build();
  const attacker = CardBuilder.create('Damage Source')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(3, 3)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{W}'), cards: [immortal], playerName: 'Protected' },
      { commander: makeCommander('Attacker Commander', '{R}'), cards: [attacker], playerName: 'Attacker' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Stoneform Sentinel' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Damage Source' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Stoneform Sentinel' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Damage Source' }, { summoningSick: false });
    },
  });

  const internal = engine as unknown as {
    sbaChecker: {
      checkAndApply: (game: GameState) => boolean;
    };
  };
  const immortalCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Stoneform Sentinel');
  const sourceCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Damage Source');

  engine.destroyPermanent(immortalCard.objectId);
  assert.ok(battlefieldNames(state, 'player1').includes('Stoneform Sentinel'));

  engine.dealDamage(sourceCard.objectId, immortalCard.objectId, 3, false);
  while (internal.sbaChecker.checkAndApply(state)) {
    continue;
  }

  assert.ok(battlefieldNames(state, 'player1').includes('Stoneform Sentinel'));
});

test('phase-rule phases permanents out and back in across untap steps', () => {
  const phaser = CardBuilder.create('Blinkstep Adept')
    .cost('{2}{U}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .staticAbility({
      type: 'phase-rule',
      phasesInDuringUntap: true,
      phasesOutDuringUntap: true,
    }, { description: 'Phasing-style rule.' })
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Primitive Commander', '{U}'), cards: [phaser], playerName: 'Phaser' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Blinkstep Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Blinkstep Adept' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.ENDING,
          currentStep: Step.CLEANUP,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  const internal = engine as unknown as {
    turnManager: {
      advanceStep: (game: GameState) => void;
      startTurn: (game: GameState, playerId: 'player1') => void;
    };
  };
  const phaserCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Blinkstep Adept');

  internal.turnManager.advanceStep(state);
  assert.equal(phaserCard.phasedOut, true);

  internal.turnManager.startTurn(state, 'player1');
  assert.equal(phaserCard.phasedOut, false);
});
