import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { prebuiltDecks } from '../../../src/cards/decks.ts';
import { SwiftfootBoots } from '../../../src/cards/sets/starter/artifacts.ts';
import { ActionType, CardType, Keyword, ManaColor, Phase, Step, Zone } from '../../../src/engine/types.ts';
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

function makeTargetingCloak() {
  return CardBuilder.create('Targeting Cloak')
    .cost('{1}')
    .types(CardType.ARTIFACT)
    .grantToAttached({ type: 'cant-be-targeted', by: 'opponents', filter: { self: true } })
    .equip('{0}')
    .build();
}

function makeAttachmentHost(name: string) {
  return CardBuilder.create(name)
    .cost('{1}{W}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

function makeProtectedCreature(name: string, protection: Parameters<CardBuilder['protection']>[0]) {
  return CardBuilder.create(name)
    .cost('{1}{W}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .protection(protection)
    .build();
}

function recalculateContinuousEffects(state: ReturnType<typeof createHarness>['state'], engine: ReturnType<typeof createHarness>['engine']) {
  const internalEngine = engine as typeof engine & {
    continuousEffects: { applyAll: (game: typeof state) => void };
  };
  internalEngine.continuousEffects.applyAll(state);
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

test('protection from white stops opposing targeted removal from being cast at the protected creature', async () => {
  const protectedCreature = makeProtectedCreature('Ivory Adept', { colors: [ManaColor.WHITE] });
  const removal = makeTargetedCreatureRemoval('Banishing Ray', '{W}');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Protection Commander', '{W}'), cards: [protectedCreature], playerName: 'Protected Player' },
      { commander: makeCommander('Removal Commander', '{W}'), cards: [removal], playerName: 'Removal Player' },
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Ivory Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Ivory Adept' }, { summoningSick: false })
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

  recalculateContinuousEffects(state, engine);
  engine.addMana('player2', 'W', 1);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player2',
    cardId: getCard(state, 'player2', Zone.HAND, 'Banishing Ray').objectId,
    targets: [getCard(state, 'player1', Zone.BATTLEFIELD, 'Ivory Adept').objectId],
  });

  assert.ok(battlefieldNames(state, 'player1').includes('Ivory Adept'));
  assert.ok(handNames(state, 'player2').includes('Banishing Ray'));
});

test('protection from white prevents noncombat damage from matching sources', async () => {
  const protectedCreature = makeProtectedCreature('Ivory Adept', { colors: [ManaColor.WHITE] });
  const whiteSource = CardBuilder.create('Sunlance Adept')
    .cost('{W}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Protection Commander', '{W}'), cards: [protectedCreature], playerName: 'Protected Player' },
      { commander: makeCommander('Damage Commander', '{W}'), cards: [whiteSource], playerName: 'Damage Player' },
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Ivory Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Ivory Adept' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Sunlance Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Sunlance Adept' }, { summoningSick: false });
    },
  });

  recalculateContinuousEffects(state, engine);
  engine.dealDamage(
    getCard(state, 'player2', Zone.BATTLEFIELD, 'Sunlance Adept').objectId,
    getCard(state, 'player1', Zone.BATTLEFIELD, 'Ivory Adept').objectId,
    2,
    false,
  );

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Ivory Adept').markedDamage, 0);
});

test('protection from artifacts stops Equipment from attaching', async () => {
  const protectedCreature = makeProtectedCreature('Sanctified Bear', { types: [CardType.ARTIFACT] });

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Protection Commander', '{W}'), cards: [protectedCreature, SwiftfootBoots], playerName: 'Protected Player' },
      prebuiltDecks[1],
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Sanctified Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Sanctified Bear' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Swiftfoot Boots' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Swiftfoot Boots' }, { summoningSick: false });
    },
  });

  recalculateContinuousEffects(state, engine);
  engine.attachPermanent(
    getCard(state, 'player1', Zone.BATTLEFIELD, 'Swiftfoot Boots').objectId,
    getCard(state, 'player1', Zone.BATTLEFIELD, 'Sanctified Bear').objectId,
  );

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Swiftfoot Boots').attachedTo, null);
});

test('protection from creatures stops creature blockers from blocking', async () => {
  const attacker = makeProtectedCreature('Untouchable Adept', { types: [CardType.CREATURE] });
  const blocker = makeAttachmentHost('Walling Bear');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Attack Commander', '{W}'), cards: [attacker], playerName: 'Attack Player' },
      { commander: makeCommander('Block Commander', '{W}'), cards: [blocker], playerName: 'Block Player' },
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Untouchable Adept' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Untouchable Adept' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Walling Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Walling Bear' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_ATTACKERS,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  recalculateContinuousEffects(state, engine);
  const internalEngine = engine as typeof engine & {
    combatManager: {
      beginCombat: (game: typeof state) => void;
      declareAttackers: (game: typeof state, declarations: Array<{ attackerId: string; defendingPlayer?: 'player2' }>, taxesPaid?: boolean) => boolean;
      declareBlockers: (game: typeof state, declarations: Array<{ blockerId: string; attackerId: string }>) => boolean;
    };
  };

  internalEngine.combatManager.beginCombat(state);
  const attackerCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Untouchable Adept');
  const blockerCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Walling Bear');
  internalEngine.combatManager.declareAttackers(state, [{ attackerId: attackerCard.objectId, defendingPlayer: 'player2' }], true);
  internalEngine.combatManager.declareBlockers(state, [{ blockerId: blockerCard.objectId, attackerId: attackerCard.objectId }]);

  assert.equal(state.combat?.blockers.size ?? 0, 0);
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

test('attached cant-be-targeted effects block opposing removal without a compatibility flag', async () => {
  const removal = makeTargetedCreatureRemoval('Pinning Light', '{W}');
  const cloak = makeTargetingCloak();
  const host = makeAttachmentHost('Cloaked Bear');
  const decks = [
    { commander: makeCommander('Cloak Commander', '{W}'), cards: [cloak, host], playerName: 'Cloak Player' },
    { commander: makeCommander('Removal Commander', '{W}'), cards: [removal], playerName: 'Removal Player' },
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: builder => {
      builder
        .moveCard({ playerId: 'player1', name: 'Targeting Cloak' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Cloaked Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Cloaked Bear' }, { summoningSick: false })
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

  await engine.submitAction({
    ...getLegalAction(engine, 'player1', action =>
      action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === getCard(state, 'player1', Zone.BATTLEFIELD, 'Targeting Cloak').objectId
    ),
    targets: [getCard(state, 'player1', Zone.BATTLEFIELD, 'Cloaked Bear').objectId],
  });
  await settleEngine();

  const hostCreature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Cloaked Bear');
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
  assert.deepEqual(battlefieldNames(state, 'player1').sort(), ['Cloaked Bear', 'Targeting Cloak'].sort());
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
