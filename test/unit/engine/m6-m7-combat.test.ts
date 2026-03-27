import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { prebuiltDecks } from '../../../src/cards/decks.ts';
import { GhostlyPrison, Propaganda } from '../../../src/cards/sets/starter/enchantments.ts';
import { ActionType, CardType, Phase, Step, Zone, type GameState } from '../../../src/engine/types.ts';
import {
  battlefieldNames,
  createHarness,
  getCard,
  graveyardNames,
  makeCommander,
} from './helpers.ts';

function createPlaneswalker(name: string, loyalty: number) {
  return CardBuilder.create(name)
    .cost('{3}')
    .types(CardType.PLANESWALKER)
    .loyalty(loyalty)
    .build();
}

function createBattle(name: string, defense: number) {
  return CardBuilder.create(name)
    .cost('{3}')
    .types(CardType.BATTLE)
    .defense(defense)
    .build();
}

function createCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function createInstantSpell(name: string) {
  return CardBuilder.create(name)
    .cost('{W}')
    .types(CardType.INSTANT)
    .build();
}

function createBasicLand(name: string, subtype: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes(subtype)
    .build();
}

function createCombatState(state: GameState, attackerName: string, blockerName?: string) {
  const attacker = getCard(state, 'player1', Zone.BATTLEFIELD, attackerName);
  const blocker = blockerName
    ? getCard(state, 'player2', Zone.BATTLEFIELD, blockerName)
    : null;

  state.combat = {
    attackingPlayer: 'player1',
    attackers: new Map([[attacker.objectId, { type: 'player', id: 'player2' }]]),
    blockers: blocker ? new Map([[blocker.objectId, attacker.objectId]]) : new Map(),
    blockerOrder: blocker ? new Map([[attacker.objectId, [blocker.objectId]]]) : new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };
}

test('declare attackers accepts planeswalker defenders and combat damage hits loyalty', async () => {
  const attacker = createCreature('Siege Tester', 3, 3);
  const walker = createPlaneswalker('Training Walker', 5);
  const instant = createInstantSpell('Hold Priority');
  const plains = createBasicLand('Hold Priority Plains', 'Plains');
  const decks = [
    { commander: makeCommander('Attack Commander'), cards: [attacker, instant, plains], playerName: 'Attacker' },
    { commander: makeCommander('Defense Commander'), cards: [walker], playerName: 'Defender' },
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Siege Tester' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Siege Tester' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Hold Priority' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Hold Priority Plains' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Hold Priority Plains' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Training Walker' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Training Walker' }, {
          controller: 'player2',
          counters: { loyalty: 5 },
        })
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

  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Siege Tester');
  const walkerCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Training Walker');

  await engine.submitAction({
    type: ActionType.DECLARE_ATTACKERS,
    playerId: 'player1',
    attackers: [{
      attackerId: attackerCard.objectId,
      defender: { type: 'planeswalker', id: walkerCard.objectId },
    }],
  });

  const attackEvents = state.eventLog.filter((event) => event.type === 'ATTACKS');
  assert.equal(attackEvents.length, 1);

  state.currentStep = Step.COMBAT_DAMAGE;
  state.priorityPlayer = 'player1';
  state.passedPriority.clear();

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });

  assert.equal(state.players.player2.life, 40);
  assert.ok(state.eventLog.some((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.targetId === walkerCard.objectId
  ));
});

test('battle targets are legal only when defended by an opponent and combat damage removes defense counters', () => {
  const attacker = createCreature('Battle Scout', 3, 3);
  const battle = createBattle('Training Siege', 5);
  const decks = [
    { commander: makeCommander('Attack Commander', '{R}'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Battle Commander', '{W}'), cards: [battle], playerName: 'Battle Owner' },
    { commander: makeCommander('Protector Commander', '{G}'), cards: [], playerName: 'Protector' },
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Battle Scout' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Battle Scout' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Training Siege' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Training Siege' }, {
          counters: { defense: 5 },
          battleProtector: 'player3',
        })
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

  const internalEngine = engine as unknown as {
    combatManager: {
      getLegalAttackTargets: (card: ReturnType<typeof getCard>, game: typeof state) => Array<{ type: string; id: string }>;
      declareAttackers: (
        game: typeof state,
        declarations: Array<{ attackerId: string; defender: { type: 'battle'; id: string } }>,
        taxesPaid?: boolean,
      ) => boolean;
      dealCombatDamage: (game: typeof state, isFirstStrike: boolean) => void;
    };
  };
  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Battle Scout');
  const battleCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Training Siege');

  const legalTargets = internalEngine.combatManager.getLegalAttackTargets(attackerCard, state);
  assert.ok(legalTargets.some((target) => target.type === 'battle' && target.id === battleCard.objectId));

  battleCard.battleProtector = 'player1';
  const selfProtectedTargets = internalEngine.combatManager.getLegalAttackTargets(attackerCard, state);
  assert.equal(selfProtectedTargets.some((target) => target.type === 'battle' && target.id === battleCard.objectId), false);

  battleCard.battleProtector = 'player3';
  assert.equal(internalEngine.combatManager.declareAttackers(state, [{
    attackerId: attackerCard.objectId,
    defender: { type: 'battle', id: battleCard.objectId },
  }], false), true);

  state.currentStep = Step.COMBAT_DAMAGE;
  internalEngine.combatManager.dealCombatDamage(state, false);

  assert.equal(battleCard.counters.defense, 2);
  assert.deepEqual(state.combat?.attackers.get(attackerCard.objectId), { type: 'battle', id: battleCard.objectId });
});

test('only the battle protector can block creatures attacking that battle', () => {
  const attacker = createCreature('Battle Intruder', 3, 3);
  const controllerBlocker = createCreature('Battle Owner Guard', 2, 2);
  const protectorBlocker = createCreature('Battle Protector Guard', 2, 2);
  const battle = createBattle('Protected Siege', 4);
  const decks = [
    { commander: makeCommander('Attack Commander', '{R}'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Battle Commander', '{W}'), cards: [battle, controllerBlocker], playerName: 'Battle Owner' },
    { commander: makeCommander('Protector Commander', '{G}'), cards: [protectorBlocker], playerName: 'Protector' },
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Battle Intruder' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Battle Intruder' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Protected Siege' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Protected Siege' }, {
          counters: { defense: 4 },
          battleProtector: 'player3',
        })
        .moveCard({ playerId: 'player2', name: 'Battle Owner Guard' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Battle Owner Guard' }, { summoningSick: false })
        .moveCard({ playerId: 'player3', name: 'Battle Protector Guard' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player3', name: 'Battle Protector Guard' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_BLOCKERS,
          priorityPlayer: 'player3',
          passedPriority: [],
        })
        .mutateState((game) => {
          const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Battle Intruder');
          const battleCard = game.zones.player2.BATTLEFIELD.find((card) => card.definition.name === 'Protected Siege');
          assert.ok(attackingCreature);
          assert.ok(battleCard);
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackingCreature.objectId, { type: 'battle', id: battleCard.objectId }]]),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const internalEngine = engine as unknown as {
    combatManager: {
      declareBlockers: (
        game: typeof state,
        declarations: Array<{ blockerId: string; attackerId: string }>,
      ) => boolean;
    };
  };
  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Battle Intruder');
  const ownerBlocker = getCard(state, 'player2', Zone.BATTLEFIELD, 'Battle Owner Guard');
  const protectorBlockerCard = getCard(state, 'player3', Zone.BATTLEFIELD, 'Battle Protector Guard');

  assert.equal(internalEngine.combatManager.declareBlockers(state, [
    { blockerId: ownerBlocker.objectId, attackerId: attackerCard.objectId },
    { blockerId: protectorBlockerCard.objectId, attackerId: attackerCard.objectId },
  ]), true);

  assert.equal(state.combat?.blockers.get(ownerBlocker.objectId), undefined);
  assert.equal(state.combat?.blockers.get(protectorBlockerCard.objectId), attackerCard.objectId);
});

test('trample can assign excess combat damage to a battle', () => {
  const attacker = CardBuilder.create('Battle Mammoth')
    .cost('{4}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .trample()
    .build();
  const blocker = createCreature('Battle Chump', 2, 2);
  const battle = createBattle('Trample Siege', 5);
  const decks = [
    { commander: makeCommander('Attack Commander', '{R}'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Battle Commander', '{W}'), cards: [battle], playerName: 'Battle Owner' },
    { commander: makeCommander('Protector Commander', '{G}'), cards: [blocker], playerName: 'Protector' },
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Battle Mammoth' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Battle Mammoth' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Trample Siege' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Trample Siege' }, {
          counters: { defense: 5 },
          battleProtector: 'player3',
        })
        .moveCard({ playerId: 'player3', name: 'Battle Chump' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player3', name: 'Battle Chump' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.COMBAT_DAMAGE,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Battle Mammoth');
          const blockingCreature = game.zones.player3.BATTLEFIELD.find((card) => card.definition.name === 'Battle Chump');
          const battleCard = game.zones.player2.BATTLEFIELD.find((card) => card.definition.name === 'Trample Siege');
          assert.ok(attackingCreature);
          assert.ok(blockingCreature);
          assert.ok(battleCard);
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackingCreature.objectId, { type: 'battle', id: battleCard.objectId }]]),
            blockers: new Map([[blockingCreature.objectId, attackingCreature.objectId]]),
            blockerOrder: new Map([[attackingCreature.objectId, [blockingCreature.objectId]]]),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const internalEngine = engine as unknown as {
    combatManager: { dealCombatDamage: (game: typeof state, isFirstStrike: boolean) => void };
  };
  const blockerCard = getCard(state, 'player3', Zone.BATTLEFIELD, 'Battle Chump');
  const battleCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Trample Siege');

  internalEngine.combatManager.dealCombatDamage(state, false);

  assert.equal(blockerCard.markedDamage, 2);
  assert.equal(battleCard.counters.defense, 3);
});

test('battles with no defense counters are put into the graveyard by state-based actions', async () => {
  const attacker = createCreature('Battle Finisher', 1, 1);
  const battle = createBattle('Fragile Siege', 1);
  const decks = [
    { commander: makeCommander('Attack Commander', '{R}'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Battle Commander', '{W}'), cards: [battle], playerName: 'Battle Owner' },
    { commander: makeCommander('Protector Commander', '{G}'), cards: [], playerName: 'Protector' },
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Battle Finisher' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Battle Finisher' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Fragile Siege' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Fragile Siege' }, {
          counters: { defense: 1 },
          battleProtector: 'player3',
        })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  const internalEngine = engine as unknown as { runGameLoop: () => Promise<void> };
  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Battle Finisher');
  const battleCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Fragile Siege');

  engine.dealDamage(attackerCard.objectId, battleCard.objectId, 1, false);
  await internalEngine.runGameLoop();

  assert.ok(graveyardNames(state, 'player2').includes('Fragile Siege'));
  assert.equal(battlefieldNames(state, 'player2').includes('Fragile Siege'), false);
});

test('Propaganda taxes attacks at declaration time', () => {
  const { state, engine } = createHarness({
    decks: prebuiltDecks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player2', name: 'Propaganda' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player4', name: 'Goblin Guide' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Goblin Guide' }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Mountain', nth: 0 }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Mountain', nth: 0 }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Mountain', nth: 1 }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Mountain', nth: 1 }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player4',
          passedPriority: [],
        })
        .mutateState((game) => {
          game.combat = {
            attackingPlayer: 'player4',
            attackers: new Map(),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const internalEngine = engine as unknown as {
    continuousEffects: { applyAll: (game: typeof state) => void };
    handleDeclareAttackers: (
      playerId: 'player4',
      attackers: Array<{ attackerId: string; defendingPlayer: 'player2' }>
    ) => void;
  };
  const attacker = getCard(state, 'player4', Zone.BATTLEFIELD, 'Goblin Guide');
  internalEngine.continuousEffects.applyAll(state);
  internalEngine.handleDeclareAttackers('player4', [{ attackerId: attacker.objectId, defendingPlayer: 'player2' }]);

  assert.ok(state.eventLog.some((event) => event.type === 'ATTACKS' && event.attackerId === attacker.objectId));
  assert.equal(state.zones.player4.BATTLEFIELD.filter((card) => card.definition.name === 'Mountain' && card.tapped).length, 2);
});

test('goaded creatures must attack a non-goader if able, but may attack the goader when taxes remove alternatives', () => {
  const attacker = createCreature('Goaded Raider', 3, 3);
  const decks = [
    { commander: makeCommander('Attack Commander', '{R}'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Goad Commander', '{R}'), cards: [], playerName: 'Goader' },
    { commander: makeCommander('Tax Commander', '{W}'), cards: [Propaganda], playerName: 'Taxer One' },
    { commander: makeCommander('Tax Commander Two', '{W}'), cards: [GhostlyPrison], playerName: 'Taxer Two' },
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Goaded Raider' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Goaded Raider' }, {
          summoningSick: false,
          counters: { 'goaded-by-player2': 1 },
        })
        .moveCard({ playerId: 'player3', name: 'Propaganda' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player4', name: 'Ghostly Prison' }, Zone.BATTLEFIELD)
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

  const internalEngine = engine as unknown as {
    continuousEffects: { applyAll: (game: typeof state) => void };
    combatManager: { getLegalAttackTargets: (card: ReturnType<typeof getCard>, game: typeof state) => Array<{ type: string; id: string }> };
  };
  internalEngine.continuousEffects.applyAll(state);
  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Goaded Raider');
  const legalTargets = internalEngine.combatManager.getLegalAttackTargets(attackerCard, state);

  assert.deepEqual(legalTargets, [{ type: 'player', id: 'player2' }]);
});

test('first strike plus deathtouch kills the blocker before normal damage', async () => {
  const attacker = CardBuilder.create('Needle Fang')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(1, 1)
    .firstStrike()
    .deathtouch()
    .build();
  const blocker = createCreature('Wall Target', 4, 4);
  const decks = [
    { commander: makeCommander('Combat Commander'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Block Commander'), cards: [blocker], playerName: 'Defender' },
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Needle Fang' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Needle Fang' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Wall Target' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Wall Target' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.COMBAT_DAMAGE,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Needle Fang');
  const blockerCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Wall Target');
  engine.dealDamage(attackerCard.objectId, blockerCard.objectId, 1, true);

  assert.equal(blockerCard.markedDamage, 1);
  assert.equal(blockerCard.counters['deathtouch-damage'], 1);
  assert.deepEqual(battlefieldNames(state, 'player1'), ['Needle Fang']);
});

test('trample assigns excess combat damage to the defending player', async () => {
  const attacker = CardBuilder.create('Trample Tester')
    .cost('{4}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .trample()
    .build();
  const blocker = createCreature('Bear Blocker', 2, 2);
  const decks = [
    { commander: makeCommander('Trample Commander'), cards: [attacker], playerName: 'Attacker' },
    { commander: makeCommander('Defense Commander'), cards: [blocker], playerName: 'Defender' },
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Trample Tester' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Trample Tester' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Bear Blocker' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Bear Blocker' }, { summoningSick: false })
        .setPlayer('player2', { life: 40 })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.COMBAT_DAMAGE,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Trample Tester');
  const blockerCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Bear Blocker');
  engine.dealDamage(attackerCard.objectId, blockerCard.objectId, 2, true);
  engine.dealDamage(attackerCard.objectId, 'player2', 2, true);

  assert.equal(blockerCard.markedDamage, 2);
  assert.equal(state.players.player2.life, 38);
});

test('regeneration shields replace destruction and remove the permanent from combat', () => {
  const protectedCreature = createCreature('Regenerator', 3, 3);
  const decks = [
    { commander: makeCommander('Regen Commander'), cards: [protectedCreature], playerName: 'Attacker' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Regenerator' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Regenerator' }, {
          summoningSick: false,
          counters: {
            'regeneration-shield': 1,
            'deathtouch-damage': 1,
          },
          markedDamage: 3,
        })
        .mutateState((game) => {
          createCombatState(game, 'Regenerator');
        });
    },
  });

  const protectedCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Regenerator');
  engine.destroyPermanent(protectedCard.objectId);

  assert.deepEqual(battlefieldNames(state, 'player1'), ['Regenerator']);
  assert.equal(protectedCard.tapped, true);
  assert.equal(protectedCard.markedDamage, 0);
  assert.equal(protectedCard.counters['regeneration-shield'], undefined);
  assert.equal(state.combat?.attackers.size, 0);
});

test('cant-regenerate overrides regeneration shields', () => {
  const protectedCreature = createCreature('Doomed Regenerator', 3, 3);
  const decks = [
    { commander: makeCommander('Regen Commander'), cards: [protectedCreature], playerName: 'Attacker' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Doomed Regenerator' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Doomed Regenerator' }, {
          summoningSick: false,
          counters: {
            'regeneration-shield': 1,
            'cant-regenerate': 1,
          },
        });
    },
  });

  engine.destroyPermanent(getCard(state, 'player1', Zone.BATTLEFIELD, 'Doomed Regenerator').objectId);
  assert.deepEqual(graveyardNames(state, 'player1'), ['Doomed Regenerator']);
});
