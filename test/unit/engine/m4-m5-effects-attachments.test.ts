import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { prebuiltDecks } from '../../../src/cards/decks.ts';
import { SwiftfootBoots } from '../../../src/cards/sets/starter/artifacts.ts';
import { ActionType, CardType, Keyword, Phase, Step, Zone } from '../../../src/engine/types.ts';
import {
  battlefieldNames,
  createHarness,
  getCard,
  getLegalAction,
  graveyardNames,
  handNames,
  makeCommander,
  makeTargetedCreatureRemoval,
  settleEngine,
} from './helpers.ts';

function makeAnthem() {
  return CardBuilder.create('Battle Anthem')
    .cost('{2}{W}')
    .types(CardType.ENCHANTMENT)
    .staticAbility(
      { type: 'pump', power: 1, toughness: 1, filter: { controller: 'you', types: [CardType.CREATURE] } },
      { description: 'Creatures you control get +1/+1.' },
    )
    .build();
}

function makeSanctuaryField() {
  return CardBuilder.create('Sanctuary Field')
    .cost('{1}{W}')
    .types(CardType.ENCHANTMENT)
    .staticAbility(
      { type: 'cant-be-targeted', by: 'opponents', filter: { controller: 'you', types: [CardType.CREATURE] } },
      { description: 'Creatures you control cannot be targeted by opponents.' },
    )
    .build();
}

function makeDamageShieldCreature() {
  return CardBuilder.create('Damage Shield Adept')
    .cost('{2}{W}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .staticAbility(
      { type: 'prevention', prevents: 'damage', filter: { self: true } },
      { description: 'Prevent all damage that would be dealt to this creature.' },
    )
    .build();
}

function makeAura() {
  return CardBuilder.create('Shielding Aura')
    .cost('{W}')
    .types(CardType.ENCHANTMENT)
    .enchant({ what: 'creature', count: 1 })
    .grantToAttached({ type: 'pump', power: 1, toughness: 1, filter: { self: true } })
    .build();
}

function makeAttachmentHost(name: string) {
  return CardBuilder.create(name)
    .cost('{1}{W}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

test('generic static anthem effects modify creature stats', async () => {
  const anthem = makeAnthem();
  const commander = makeCommander('Anthem Commander');
  const decks = [
    { commander, cards: [anthem], playerName: 'Anthem Player' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Battle Anthem' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Anthem Commander' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Anthem Commander' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await settleEngine();

  const anthemCommander = getCard(state, 'player1', Zone.BATTLEFIELD, 'Anthem Commander');
  assert.equal(anthemCommander.modifiedPower, 4);
  assert.equal(anthemCommander.modifiedToughness, 4);
});

test('generic prevention effects stop damage from being marked', async () => {
  const shieldCreature = makeDamageShieldCreature();
  const decks = [
    { commander: makeCommander('Shield Commander'), cards: [shieldCreature], playerName: 'Shield Player' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Damage Shield Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Damage Shield Adept' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  engine.dealDamage(
    getCard(state, 'player2', Zone.BATTLEFIELD, 'Talrand, Sky Summoner').objectId,
    getCard(state, 'player1', Zone.BATTLEFIELD, 'Damage Shield Adept').objectId,
    2,
    false,
  );

  const adept = getCard(state, 'player1', Zone.BATTLEFIELD, 'Damage Shield Adept');
  assert.equal(adept.markedDamage, 0);
});

test('generic cant-be-targeted static effects stop opposing removal', async () => {
  const sanctuary = makeSanctuaryField();
  const removal = makeTargetedCreatureRemoval('Banishing Ray', '{1}{W}');
  const decks = [
    { commander: makeCommander('Sanctuary Commander', '{W}'), cards: [sanctuary], playerName: 'Protected Player' },
    { commander: makeCommander('Removal Commander', '{W}'), cards: [removal], playerName: 'Removal Player' },
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Sanctuary Field' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Sanctuary Commander' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Sanctuary Commander' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Banishing Ray' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player2' });
  await settleEngine();

  state.priorityPlayer = 'player2';
  engine.addMana('player2', 'W', 2);
  const protectedCreature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Sanctuary Commander');
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player2',
    cardId: getCard(state, 'player2', Zone.HAND, 'Banishing Ray').objectId,
    targets: [protectedCreature.objectId],
  });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player2'), ['Banishing Ray']);
  assert.equal(state.players.player2.manaPool.W, 2);
  assert.deepEqual(battlefieldNames(state, 'player1'), ['Sanctuary Field', 'Sanctuary Commander']);
});

test('attack taxes are paid before attackers can be declared', async () => {
  const { state, engine } = createHarness({
    decks: prebuiltDecks,
    setup: builder => {
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
        .mutateState(game => {
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

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await settleEngine();
  state.currentPhase = Phase.COMBAT;
  state.currentStep = Step.DECLARE_ATTACKERS;
  state.activePlayer = 'player4';
  state.priorityPlayer = 'player4';
  state.passedPriority = new Set();
  state.combat = {
    attackingPlayer: 'player4',
    attackers: new Map(),
    blockers: new Map(),
    blockerOrder: new Map(),
    damageAssignments: [],
    firstStrikeDamageDealt: false,
  };

  await engine.submitAction({
    type: ActionType.DECLARE_ATTACKERS,
    playerId: 'player4',
    attackers: [{
      attackerId: getCard(state, 'player4', Zone.BATTLEFIELD, 'Goblin Guide').objectId,
      defendingPlayer: 'player2',
    }],
  });
  await settleEngine();

  const attacksEvent = state.eventLog.find(event =>
    event.type === 'ATTACKS' &&
    event.attackerId === getCard(state, 'player4', Zone.BATTLEFIELD, 'Goblin Guide').objectId
  );
  assert.ok(attacksEvent);
  assert.equal(getCard(state, 'player4', Zone.BATTLEFIELD, 'Mountain').tapped, true);
  assert.equal(state.players.player4.manaPool.R + state.players.player4.manaPool.C + state.players.player4.manaPool.W + state.players.player4.manaPool.U + state.players.player4.manaPool.B + state.players.player4.manaPool.G, 0);
});

test('Swiftfoot Boots equips and grants haste plus hexproof through shared attachment rules', async () => {
  const removal = makeTargetedCreatureRemoval('Pinning Light', '{W}');
  const host = makeAttachmentHost('Boots Bear');
  const decks = [
    { commander: makeCommander('Boots Commander', '{W}'), cards: [SwiftfootBoots, host], playerName: 'Boots Player' },
    { commander: makeCommander('Removal Commander', '{W}'), cards: [removal], playerName: 'Removal Player' },
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Swiftfoot Boots' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Boots Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Boots Bear' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Pinning Light' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'W', 1);
  await engine.submitAction({
    ...getLegalAction(engine, 'player1', action =>
      action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === getCard(state, 'player1', Zone.BATTLEFIELD, 'Swiftfoot Boots').objectId
    ),
    targets: [getCard(state, 'player1', Zone.BATTLEFIELD, 'Boots Bear').objectId],
  });
  await settleEngine();

  const boots = getCard(state, 'player1', Zone.BATTLEFIELD, 'Swiftfoot Boots');
  const hostCreature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Boots Bear');
  assert.equal(boots.attachedTo, hostCreature.objectId);
  assert.ok(hostCreature.attachments.includes(boots.objectId));
  assert.ok((hostCreature.modifiedKeywords ?? []).includes(Keyword.HASTE));
  assert.ok((hostCreature.modifiedKeywords ?? []).includes(Keyword.HEXPROOF));

  state.priorityPlayer = 'player2';
  engine.addMana('player2', 'W', 1);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player2',
    cardId: getCard(state, 'player2', Zone.HAND, 'Pinning Light').objectId,
    targets: [hostCreature.objectId],
  });
  await settleEngine();

  assert.deepEqual(handNames(state, 'player2'), ['Pinning Light']);
  assert.deepEqual(battlefieldNames(state, 'player1').sort(), ['Boots Bear', 'Swiftfoot Boots'].sort());

  engine.destroyPermanent(hostCreature.objectId);
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player2' });
  await settleEngine();

  const survivingBoots = getCard(state, 'player1', Zone.BATTLEFIELD, 'Swiftfoot Boots');
  assert.equal(survivingBoots.attachedTo, null);
  assert.ok(graveyardNames(state, 'player1').includes('Boots Bear'));
});

test('Auras attach on resolution and fall off when the host leaves the battlefield', async () => {
  const aura = makeAura();
  const host = makeAttachmentHost('Aura Bear');
  const decks = [
    { commander: makeCommander('Aura Commander', '{W}'), cards: [aura, host], playerName: 'Aura Player' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Shielding Aura' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Aura Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Aura Bear' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'W', 1);
  const hostCreature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Aura Bear');
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Shielding Aura').objectId,
    targets: [hostCreature.objectId],
  });
  await settleEngine();

  const auraPermanent = getCard(state, 'player1', Zone.BATTLEFIELD, 'Shielding Aura');
  assert.equal(auraPermanent.attachedTo, hostCreature.objectId);
  assert.ok(hostCreature.attachments.includes(auraPermanent.objectId));
  assert.equal(hostCreature.modifiedPower, 3);
  assert.equal(hostCreature.modifiedToughness, 3);

  engine.destroyPermanent(hostCreature.objectId);
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await settleEngine();

  assert.ok(graveyardNames(state, 'player1').includes('Aura Bear'));
  assert.ok(graveyardNames(state, 'player1').includes('Shielding Aura'));
});
