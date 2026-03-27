import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { AlliesAtLast } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, handNames, makeCommander } from './helpers.ts';

test('kicked and non-kicked spells branch on the shared additional-cost state', async () => {
  const kickerSpell = CardBuilder.create('Kicker Burst')
    .cost('{U}')
    .types(CardType.SORCERY)
    .kicker('{1}')
    .spellEffect((ctx) => {
      ctx.game.loseLife('player2', ctx.additionalCostsPaid?.includes('kicker') ? 3 : 1);
    })
    .build();

  const runCase = async (payKicker: boolean) => {
    const { state, engine } = createHarness({
      decks: [
        { commander: makeCommander('Kicker Commander', '{U}'), cards: [kickerSpell], playerName: 'Kicker Player' },
        { commander: makeCommander('Target Commander', '{2}'), cards: [], playerName: 'Target' },
        { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Kicker Burst' }, Zone.HAND)
          .setTurn({
            activePlayer: 'player1',
            currentPhase: Phase.PRECOMBAT_MAIN,
            currentStep: Step.MAIN,
            priorityPlayer: 'player1',
            passedPriority: [],
          });
      },
      choiceResponder: (request) => {
        if (request.type === 'chooseYesNo' && request.prompt.includes('Pay additional cost Kicker?')) {
          request.resolve(payKicker);
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
      },
    });

    engine.addMana('player1', 'U', 1);
    if (payKicker) {
      engine.addMana('player1', 'C', 1);
    }
    await engine.submitAction({
      type: ActionType.CAST_SPELL,
      playerId: 'player1',
      cardId: getCard(state, 'player1', Zone.HAND, 'Kicker Burst').objectId,
    });

    return state.players.player2.life;
  };

  assert.equal(await runCase(false), 39);
  assert.equal(await runCase(true), 37);
});

test('Allies at Last becomes castable through affinity for Allies', () => {
  const allyA = CardBuilder.create('Ally Vanguard')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .subtypes('Ally')
    .stats(2, 2)
    .build();
  const allyB = CardBuilder.create('Ally Outrider')
    .cost('{2}{G}')
    .types(CardType.CREATURE)
    .subtypes('Ally')
    .stats(3, 3)
    .build();
  const forest = CardBuilder.create('Affinity Forest')
    .types(CardType.LAND)
    .subtypes('Forest')
    .tapForMana('G')
    .build();
  const opposingCreature = CardBuilder.create('Target Dummy')
    .cost('{3}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Affinity Commander', '{G}'), cards: [AlliesAtLast, allyA, allyB, forest], playerName: 'Affinity' },
      { commander: makeCommander('Target Commander', '{2}'), cards: [opposingCreature], playerName: 'Target' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Allies at Last' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Ally Vanguard' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Ally Outrider' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Affinity Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Target Dummy' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Ally Vanguard' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Ally Outrider' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Target Dummy' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const castAction = getLegalAction(engine, 'player1', (action) =>
    action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Allies at Last').objectId,
  );

  assert.equal(castAction.type, ActionType.CAST_SPELL);
});

test('Allies at Last prompts for omitted targets and each chosen Ally deals damage equal to its power', async () => {
  const allyA = CardBuilder.create('Allied Cub')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .subtypes('Ally')
    .stats(2, 2)
    .build();
  const allyB = CardBuilder.create('Allied Veteran')
    .cost('{2}{G}')
    .types(CardType.CREATURE)
    .subtypes('Ally')
    .stats(3, 3)
    .build();
  const forest = CardBuilder.create('Targeting Forest')
    .types(CardType.LAND)
    .subtypes('Forest')
    .tapForMana('G')
    .build();
  const opposingCreature = CardBuilder.create('Blocking Brute')
    .cost('{3}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Allies Commander', '{G}'), cards: [AlliesAtLast, allyA, allyB, forest], playerName: 'Allies' },
      { commander: makeCommander('Target Commander', '{2}'), cards: [opposingCreature], playerName: 'Target' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Allies at Last' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Allied Cub' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Allied Veteran' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Targeting Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Blocking Brute' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Allied Cub' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Allied Veteran' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Blocking Brute' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  await engine.submitAction(getLegalAction(engine, 'player1', (action) =>
    action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, 'Allies at Last').objectId,
  ));

  assert.ok(graveyardNames(state, 'player1').includes('Allies at Last'));
  assert.ok(graveyardNames(state, 'player2').includes('Blocking Brute'));
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Targeting Forest').tapped, true);
});

test('Allies at Last preserves target order when one chosen Ally becomes illegal before resolution', async () => {
  const allyA = CardBuilder.create('Resolving Ally A')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .subtypes('Ally')
    .stats(2, 2)
    .build();
  const allyB = CardBuilder.create('Resolving Ally B')
    .cost('{2}{G}')
    .types(CardType.CREATURE)
    .subtypes('Ally')
    .stats(3, 3)
    .build();
  const forest = CardBuilder.create('Resolution Forest')
    .types(CardType.LAND)
    .subtypes('Forest')
    .tapForMana('G')
    .build();
  const opposingCreature = CardBuilder.create('Surviving Target')
    .cost('{3}')
    .types(CardType.CREATURE)
    .stats(3, 5)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Resolution Commander', '{G}'), cards: [AlliesAtLast, allyA, allyB, forest], playerName: 'Allies' },
      { commander: makeCommander('Target Commander', '{2}'), cards: [opposingCreature], playerName: 'Target' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Allies at Last' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Resolving Ally A' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Resolving Ally B' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Resolution Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Surviving Target' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Resolving Ally A' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Resolving Ally B' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player2', name: 'Surviving Target' }, { summoningSick: false })
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
    handleCastSpell: (
      playerId: 'player1',
      cardId: string,
      targets?: (string | 'player1' | 'player2' | 'player3' | 'player4')[],
    ) => Promise<void>;
    resolveTopOfStack: () => Promise<void>;
  };

  await internalEngine.handleCastSpell(
    'player1',
    getCard(state, 'player1', Zone.HAND, 'Allies at Last').objectId,
    [
      getCard(state, 'player1', Zone.BATTLEFIELD, 'Resolving Ally A').objectId,
      getCard(state, 'player1', Zone.BATTLEFIELD, 'Resolving Ally B').objectId,
      getCard(state, 'player2', Zone.BATTLEFIELD, 'Surviving Target').objectId,
    ],
  );

  engine.returnToHand(getCard(state, 'player1', Zone.BATTLEFIELD, 'Resolving Ally A').objectId);
  await internalEngine.resolveTopOfStack();

  assert.equal(getCard(state, 'player2', Zone.BATTLEFIELD, 'Surviving Target').markedDamage, 3);
  assert.ok(graveyardNames(state, 'player1').includes('Allies at Last'));
});

test('cascade exiles into a lower-mana spell and casts it for free', async () => {
  const cascadeSpell = CardBuilder.create('Wild Cascade')
    .cost('{3}{R}')
    .types(CardType.SORCERY)
    .cascade()
    .spellEffect(() => {})
    .build();
  const prizeSpell = CardBuilder.create('Cascade Prize')
    .cost('{1}')
    .types(CardType.SORCERY)
    .spellEffect((ctx) => {
      ctx.game.createPredefinedToken(ctx.controller, 'Treasure');
    })
    .build();
  const filler = CardBuilder.create('Cascade Filler')
    .cost('{5}')
    .types(CardType.SORCERY)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Cascade Commander', '{R}'), cards: [filler, prizeSpell, cascadeSpell], playerName: 'Cascade Player' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Wild Cascade' }, Zone.HAND)
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
  engine.addMana('player1', 'C', 3);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Wild Cascade').objectId,
  });

  assert.ok(state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Treasure'));
  assert.ok(graveyardNames(state, 'player1').includes('Cascade Prize'));
});

test('cycling activates from hand, discards the card, and draws a replacement', async () => {
  const cyclingCard = CardBuilder.create('Cycling Insight')
    .cost('{2}')
    .types(CardType.SORCERY)
    .cycling('{1}')
    .build();
  const drawBuffer = CardBuilder.create('Cycle Reward')
    .cost('{1}')
    .types(CardType.SORCERY)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Cycle Commander', '{2}'), cards: [drawBuffer, cyclingCard], playerName: 'Cycler' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Cycling Insight' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'C', 1);
  await engine.submitAction({
    ...getLegalAction(engine, 'player1', (action) =>
      action.type === ActionType.ACTIVATE_ABILITY && action.sourceId === getCard(state, 'player1', Zone.HAND, 'Cycling Insight').objectId
    ),
  });

  assert.ok(graveyardNames(state, 'player1').includes('Cycling Insight'));
  assert.ok(handNames(state, 'player1').includes('Cycle Reward'));
});

test('Cyclonic Rift style spells branch on overload status', async () => {
  const overloadSpell = CardBuilder.create('Cyclonic Lesson')
    .cost('{1}{U}')
    .types(CardType.INSTANT)
    .overload('{6}{U}')
    .spellEffect((ctx) => {
      if (ctx.castMethod === 'overload') {
        const opposingPermanents = ctx.game.getBattlefield(undefined).filter((card) => card.controller !== ctx.controller);
        for (const permanent of opposingPermanents) {
          ctx.game.returnToHand(permanent.objectId);
        }
        return;
      }
      const target = ctx.targets[0];
      if (target && typeof target !== 'string') {
        ctx.game.returnToHand(target.objectId);
      }
    }, {
      targets: [{ what: 'permanent', controller: 'opponent', count: 1 }],
    })
    .build();
  const targetA = CardBuilder.create('Bounce Target A').cost('{2}').types(CardType.CREATURE).stats(2, 2).build();
  const targetB = CardBuilder.create('Bounce Target B').cost('{2}').types(CardType.CREATURE).stats(2, 2).build();

  const runCase = async (overload: boolean) => {
    const { state, engine } = createHarness({
      decks: [
        { commander: makeCommander('Overload Commander', '{U}'), cards: [overloadSpell], playerName: 'Caster' },
        { commander: makeCommander('Target Commander', '{2}'), cards: [targetA, targetB], playerName: 'Target' },
        { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Cyclonic Lesson' }, Zone.HAND)
          .moveCard({ playerId: 'player2', name: 'Bounce Target A' }, Zone.BATTLEFIELD)
          .setBattlefieldCard({ playerId: 'player2', name: 'Bounce Target A' }, { summoningSick: false })
          .moveCard({ playerId: 'player2', name: 'Bounce Target B' }, Zone.BATTLEFIELD)
          .setBattlefieldCard({ playerId: 'player2', name: 'Bounce Target B' }, { summoningSick: false })
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
      handleCastSpell: (
        playerId: 'player1',
        cardId: string,
        targets?: (string | 'player1' | 'player2' | 'player3' | 'player4')[],
        requestedModeChoices?: number[],
        xValue?: number,
        chosenFace?: 'front' | 'back',
        chosenHalf?: 'left' | 'right' | 'fused',
        requestedCastMethod?: string,
      ) => Promise<void>;
      resolveTopOfStack: () => Promise<void>;
    };

    if (overload) {
      engine.addMana('player1', 'U', 1);
      engine.addMana('player1', 'C', 6);
      await internalEngine.handleCastSpell(
        'player1',
        getCard(state, 'player1', Zone.HAND, 'Cyclonic Lesson').objectId,
        [],
        undefined,
        undefined,
        undefined,
        undefined,
        'overload',
      );
    } else {
      engine.addMana('player1', 'U', 1);
      engine.addMana('player1', 'C', 1);
      await internalEngine.handleCastSpell(
        'player1',
        getCard(state, 'player1', Zone.HAND, 'Cyclonic Lesson').objectId,
        [getCard(state, 'player2', Zone.BATTLEFIELD, 'Bounce Target A').objectId],
      );
    }

    await internalEngine.resolveTopOfStack();

    return {
      battlefield: state.zones.player2.BATTLEFIELD.map((card) => card.definition.name).sort(),
      hand: state.zones.player2.HAND.map((card) => card.definition.name).sort(),
    };
  };

  assert.deepEqual(await runCase(false), {
    battlefield: ['Bounce Target B'],
    hand: ['Bounce Target A'],
  });
  assert.deepEqual(await runCase(true), {
    battlefield: [],
    hand: ['Bounce Target A', 'Bounce Target B'],
  });
});

test('storm creates one copy for each spell cast before it this turn', async () => {
  const stormSpell = CardBuilder.create('Storm Volley')
    .cost('{1}{R}')
    .types(CardType.SORCERY)
    .storm()
    .spellEffect((ctx) => {
      ctx.game.loseLife('player2', 1);
    })
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Storm Commander', '{R}'), cards: [stormSpell], playerName: 'Storm Player' },
      { commander: makeCommander('Target Commander', '{2}'), cards: [], playerName: 'Target' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Storm Volley' }, Zone.HAND)
        .setPlayer('player1', { spellsCastThisTurn: 2 })
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
  engine.addMana('player1', 'C', 1);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Storm Volley').objectId,
  });

  assert.equal(state.players.player2.life, 37);
});

test('flashback casts from graveyard and exiles the card after resolution', async () => {
  const flashbackSpell = CardBuilder.create('Memory Spark')
    .cost('{2}{R}')
    .types(CardType.SORCERY)
    .flashback('{R}')
    .spellEffect((ctx) => {
      ctx.game.loseLife('player2', 2);
    })
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Flashback Commander', '{R}'), cards: [flashbackSpell], playerName: 'Flashback Player' },
      { commander: makeCommander('Target Commander', '{2}'), cards: [], playerName: 'Target' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Memory Spark' }, Zone.GRAVEYARD)
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
    cardId: getCard(state, 'player1', Zone.GRAVEYARD, 'Memory Spark').objectId,
    castMethod: 'flashback',
  });

  assert.equal(state.players.player2.life, 38);
  assert.ok(state.zones.player1.EXILE.some((card) => card.definition.name === 'Memory Spark'));
});

test('landfall triggers when a land enters under your control', async () => {
  const landfallPermanent = CardBuilder.create('Landfall Scout')
    .cost('{1}{G}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .landfall((ctx) => {
      ctx.game.createPredefinedToken(ctx.controller, 'Treasure');
    })
    .build();
  const land = CardBuilder.create('Testing Forest')
    .types(CardType.LAND)
    .subtypes('Forest')
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Landfall Commander', '{G}'), cards: [landfallPermanent, land], playerName: 'Landfall Player' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Landfall Scout' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Landfall Scout' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Testing Forest' }, Zone.HAND)
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
    type: ActionType.PLAY_LAND,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Testing Forest').objectId,
  });

  assert.ok(state.zones.player1.BATTLEFIELD.some((card) => card.definition.name === 'Treasure'));
});
