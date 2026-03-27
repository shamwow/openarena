import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { GhostlyPrison } from '../../../src/cards/sets/starter/enchantments.ts';
import { createHarness, getCard, getLegalAction, makeCommander, makeSmotheringTithe, battlefieldNames, commandNames, graveyardNames, handNames, makeTargetedCreatureRemoval, makeWardedCreature } from './helpers.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { prebuiltDecks } from '../../../src/cards/decks.ts';

test('commander death and recast keeps command-zone casting available', () => {
  const commander = makeCommander('Test Commander', '{3}');
  const decks = [
    { commander, cards: [], playerName: 'Commander One' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: Phase.PRECOMBAT_MAIN,
        currentStep: Step.MAIN,
        priorityPlayer: 'player1',
        passedPriority: [],
      });
    },
  });

  const commanderId = state.players.player1.commanderIds[0];
  state.players.player1.commanderTimesCast[commanderId] = 1;
  engine.addMana('player1', 'C', 5);

  const castCommander = getLegalAction(engine, 'player1', action =>
    action.type === ActionType.CAST_SPELL && action.cardId === commanderId
  );
  assert.equal(castCommander.type, ActionType.CAST_SPELL);

  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  assert.deepEqual(battlefieldNames(state, 'player1'), ['Test Commander']);
  engine.destroyPermanent(commanderId);
  assert.deepEqual(commandNames(state, 'player1'), ['Test Commander']);

  engine.submitAction({
    type: ActionType.COMMANDER_TO_COMMAND_ZONE,
    playerId: 'player1',
    cardId: commanderId,
  });
  assert.deepEqual(commandNames(state, 'player1'), ['Test Commander']);

  const recastCommander = getLegalAction(engine, 'player1', action =>
    action.type === ActionType.CAST_SPELL && action.cardId === commanderId
  );
  assert.equal(recastCommander.type, ActionType.CAST_SPELL);
});

test('commander bounce can be normalized back into the command zone', async () => {
  const commander = makeCommander('Bounce Commander', '{2}');
  const decks = [
    { commander, cards: [], playerName: 'Commander One' },
    prebuiltDecks[1],
    prebuiltDecks[2],
    prebuiltDecks[3],
  ];

  const { state, engine } = createHarness({
    decks,
    setup: (builder) => {
      builder.setTurn({
        activePlayer: 'player1',
        currentPhase: Phase.PRECOMBAT_MAIN,
        currentStep: Step.MAIN,
        priorityPlayer: 'player1',
        passedPriority: [],
      });
    },
  });

  const commanderId = state.players.player1.commanderIds[0];
  state.players.player1.commanderTimesCast[commanderId] = 1;
  engine.moveCard(commanderId, Zone.BATTLEFIELD, 'player1');
  engine.returnToHand(commanderId);
  assert.deepEqual(commandNames(state, 'player1'), ['Bounce Commander']);
  engine.addMana('player1', 'C', 4);
  assert.ok(getLegalAction(engine, 'player1', action =>
    action.type === ActionType.CAST_SPELL && action.cardId === commanderId
  ));
});

test('Smothering Tithe creates a Treasure when an opponent draws', async () => {
  const { state, engine } = createHarness({
    decks: [
      prebuiltDecks[0],
      {
        commander: makeCommander('Trigger Commander', '{2}'),
        cards: [makeSmotheringTithe()],
        playerName: 'Trigger Player',
      },
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player2', name: 'Smothering Tithe' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Swords to Plowshares' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const treasuresBefore = battlefieldNames(state, 'player2').filter(name => name === 'Treasure').length;
  engine.drawCards('player1', 1);
  const internalEngine = engine as unknown as {
    placePendingTriggers: () => Promise<boolean>;
    resolveTopOfStack: () => Promise<void>;
  };
  assert.equal(await internalEngine.placePendingTriggers(), true);
  await internalEngine.resolveTopOfStack();
  const treasuresAfter = battlefieldNames(state, 'player2').filter(name => name === 'Treasure').length;

  assert.equal(treasuresAfter, treasuresBefore + 1);
});

test('Rhystic Study should draw a card when an opponent casts a spell', async () => {
  const simpleSpell = CardBuilder.create('Simple Spell')
    .cost('{W}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Caster Commander', '{W}'), cards: [simpleSpell], playerName: 'Caster' },
      prebuiltDecks[1],
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player2', name: 'Rhystic Study' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Simple Spell' }, Zone.HAND)
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
  const handBefore = handNames(state, 'player2').length;
  const internalEngine = engine as unknown as {
    handleCastSpell: (playerId: 'player1', cardId: string, targets: (string | 'player1' | 'player2' | 'player3' | 'player4')[]) => Promise<void>;
    placePendingTriggers: () => Promise<boolean>;
    resolveTopOfStack: () => Promise<void>;
  };
  await internalEngine.handleCastSpell(
    'player1',
    getCard(state, 'player1', Zone.HAND, 'Simple Spell').objectId,
    [],
  );
  assert.equal(await internalEngine.placePendingTriggers(), true);
  await internalEngine.resolveTopOfStack();

  assert.equal(handNames(state, 'player2').length, handBefore + 1);
});

test('first strike plus deathtouch should survive through combat damage sequencing', async () => {
  const attacker = CardBuilder.create('Needle Fang')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(1, 1)
    .firstStrike()
    .deathtouch()
    .build();
  const blocker = CardBuilder.create('Wall Target')
    .cost('{3}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Combat Commander', '{2}'), cards: [attacker], playerName: 'Attacker' },
      { commander: makeCommander('Block Commander', '{2}'), cards: [blocker], playerName: 'Blocker' },
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Needle Fang' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Needle Fang' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Wall Target' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Wall Target' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.FIRST_STRIKE_DAMAGE,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          const attackerCard = getCard(game, 'player1', Zone.BATTLEFIELD, 'Needle Fang');
          const blockerCard = getCard(game, 'player2', Zone.BATTLEFIELD, 'Wall Target');
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackerCard.objectId, { type: 'player', id: 'player2' }]]),
            blockers: new Map([[blockerCard.objectId, attackerCard.objectId]]),
            blockerOrder: new Map([[attackerCard.objectId, [blockerCard.objectId]]]),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  const internalEngine = engine as unknown as {
    combatManager: { dealCombatDamage: (game: typeof state, isFirstStrike: boolean) => void };
    sbaChecker: { checkAndApply: (game: typeof state) => boolean };
  };
  internalEngine.combatManager.dealCombatDamage(state, true);
  assert.equal(internalEngine.sbaChecker.checkAndApply(state), true);
  internalEngine.combatManager.dealCombatDamage(state, false);
  assert.ok(battlefieldNames(state, 'player1').includes('Needle Fang'));
  assert.ok(graveyardNames(state, 'player2').includes('Wall Target'));
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Needle Fang').markedDamage, 0);
});

test('ward prompts should be paid before a targeted spell resolves', async () => {
  const removal = makeTargetedCreatureRemoval('Pinpoint Light', '{W}');
  const warded = makeWardedCreature('Ward Bear');
  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Ward Commander', '{2}'), cards: [warded], playerName: 'Protected' },
      { commander: makeCommander('Removal Commander', '{W}'), cards: [removal], playerName: 'Caster' },
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Ward Bear' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Ward Bear' }, { summoningSick: false })
        .moveCard({ playerId: 'player2', name: 'Pinpoint Light' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player2',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player2',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player2', 'W', 1);
  engine.addMana('player2', 'C', 2);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player2',
    cardId: getCard(state, 'player2', Zone.HAND, 'Pinpoint Light').objectId,
    targets: [getCard(state, 'player1', Zone.BATTLEFIELD, 'Ward Bear').objectId],
  });

  assert.ok(graveyardNames(state, 'player1').includes('Ward Bear'));
});

test('Propaganda and Ghostly Prison should tax attacks at declaration time', async () => {
  const { state, engine } = createHarness({
    decks: [
      prebuiltDecks[0],
      prebuiltDecks[1],
      { commander: makeCommander('Prison Commander', '{W}'), cards: [GhostlyPrison], playerName: 'Prison Player' },
      prebuiltDecks[3],
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player2', name: 'Propaganda' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player3', name: 'Ghostly Prison' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player4', name: 'Goblin Guide' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Goblin Guide' }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Mountain', nth: 0 }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Mountain', nth: 0 }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Mountain', nth: 1 }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Mountain', nth: 1 }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Mountain', nth: 2 }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Mountain', nth: 2 }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Mountain', nth: 3 }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player4', name: 'Mountain', nth: 3 }, { summoningSick: false })
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

  const attacker = getCard(state, 'player4', Zone.BATTLEFIELD, 'Goblin Guide');
  const internalEngine = engine as unknown as {
    continuousEffects: { applyAll: (game: typeof state) => void };
    handleDeclareAttackers: (
      playerId: 'player4',
      attackers: Array<{ attackerId: string; defendingPlayer: 'player2' }>
    ) => void;
  };
  internalEngine.continuousEffects.applyAll(state);
  internalEngine.handleDeclareAttackers('player4', [{ attackerId: attacker.objectId, defendingPlayer: 'player2' }]);

  assert.ok(state.eventLog.some((event) => event.type === 'ATTACKS' && event.attackerId === attacker.objectId));
  assert.equal(state.zones.player4.BATTLEFIELD.filter((card) => card.definition.name === 'Mountain' && card.tapped).length, 2);
});

test('modal spells should validate target legality using the chosen mode, not mode 0', async () => {
  const modalSpell = CardBuilder.create('Forked Choice')
    .cost('{R}')
    .types(CardType.INSTANT)
    .modal([
      {
        label: 'Deal 2 damage to target creature',
        targets: [{ what: 'creature', count: 1 }],
        effect: (ctx) => {
          const target = ctx.targets[0];
          if (target && typeof target !== 'string') {
            ctx.game.dealDamage(ctx.source.objectId, target.objectId, 2, false);
          }
        },
      },
      {
        label: 'Deal 2 damage to target player',
        targets: [{ what: 'player', count: 1 }],
        effect: (ctx) => {
          const target = ctx.targets[0];
          if (typeof target === 'string') {
            ctx.game.loseLife(target, 2);
          }
        },
      },
    ], 1)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Modal Commander', '{R}'), cards: [modalSpell], playerName: 'Modal Player' },
      prebuiltDecks[1],
      prebuiltDecks[2],
      prebuiltDecks[3],
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Forked Choice' }, Zone.HAND)
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
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Forked Choice').objectId,
    modeChoices: [1],
    targets: ['player2'],
  });

  assert.equal(state.players.player2.life, 38);
});
