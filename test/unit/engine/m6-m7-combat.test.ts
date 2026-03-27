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
