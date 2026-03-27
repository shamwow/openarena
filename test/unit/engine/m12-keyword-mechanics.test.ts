import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, getCard, getLegalAction, graveyardNames, handNames, makeCommander } from './helpers.ts';

function createCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

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

test('sneak is only offered during your declare blockers step with an unblocked attacker', () => {
  const attacker = createCreature('Sneak Scout', 2, 2);
  const blocker = createCreature('Sneak Wall', 1, 4);
  const sneakCreature = CardBuilder.create('Sewer Ambusher')
    .cost('{4}{R}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .sneak('{1}{R}')
    .build();

  const canSneak = (step: Step, activePlayer: 'player1' | 'player2', blocked: boolean) => {
    const { state, engine } = createHarness({
      decks: [
        { commander: makeCommander('Sneak Commander', '{R}'), cards: [attacker, sneakCreature], playerName: 'Sneak Player' },
        { commander: makeCommander('Defense Commander', '{W}'), cards: [blocker], playerName: 'Defender' },
        { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Sneak Scout' }, Zone.BATTLEFIELD)
          .setBattlefieldCard({ playerId: 'player1', name: 'Sneak Scout' }, { summoningSick: false })
          .moveCard({ playerId: 'player1', name: 'Sewer Ambusher' }, Zone.HAND)
          .moveCard({ playerId: 'player2', name: 'Sneak Wall' }, Zone.BATTLEFIELD)
          .setBattlefieldCard({ playerId: 'player2', name: 'Sneak Wall' }, { summoningSick: false })
          .setTurn({
            activePlayer,
            currentPhase: step === Step.MAIN ? Phase.PRECOMBAT_MAIN : Phase.COMBAT,
            currentStep: step,
            priorityPlayer: 'player1',
            passedPriority: [],
          })
          .mutateState((game) => {
            const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Sneak Scout');
            const blockingCreature = game.zones.player2.BATTLEFIELD.find((card) => card.definition.name === 'Sneak Wall');
            assert.ok(attackingCreature);
            assert.ok(blockingCreature);

            game.combat = {
              attackingPlayer: activePlayer,
              attackers: new Map([[attackingCreature.objectId, { type: 'player', id: 'player2' }]]),
              blockers: blocked ? new Map([[blockingCreature.objectId, attackingCreature.objectId]]) : new Map(),
              blockerOrder: blocked ? new Map([[attackingCreature.objectId, [blockingCreature.objectId]]]) : new Map(),
              damageAssignments: [],
              firstStrikeDamageDealt: false,
            };
          });
      },
    });

    engine.addMana('player1', 'R', 1);
    engine.addMana('player1', 'C', 1);
    const sneakId = getCard(state, 'player1', Zone.HAND, 'Sewer Ambusher').objectId;
    return engine.getLegalActions('player1').some((action) =>
      action.type === ActionType.CAST_SPELL &&
      action.cardId === sneakId &&
      action.castMethod === 'sneak'
    );
  };

  assert.equal(canSneak(Step.DECLARE_BLOCKERS, 'player1', false), true);
  assert.equal(canSneak(Step.MAIN, 'player1', false), false);
  assert.equal(canSneak(Step.DECLARE_BLOCKERS, 'player2', false), false);
  assert.equal(canSneak(Step.DECLARE_BLOCKERS, 'player1', true), false);
});

test('illegal sneak submissions outside the declare blockers window are rejected', async () => {
  const attacker = createCreature('Rejected Sneak Attacker', 2, 2);
  const sneakCreature = CardBuilder.create('Rejected Sneak Spell')
    .cost('{4}{R}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .sneak('{1}{R}')
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Sneak Commander', '{R}'), cards: [attacker, sneakCreature], playerName: 'Sneak Player' },
      { commander: makeCommander('Defense Commander', '{W}'), cards: [], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Rejected Sneak Attacker' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Rejected Sneak Attacker' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Rejected Sneak Spell' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Rejected Sneak Attacker');
          assert.ok(attackingCreature);
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackingCreature.objectId, { type: 'player', id: 'player2' }]]),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'C', 1);
  const sneakCardId = getCard(state, 'player1', Zone.HAND, 'Rejected Sneak Spell').objectId;

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: sneakCardId,
    castMethod: 'sneak',
  });

  assert.equal(state.stack.length, 0);
  assert.ok(handNames(state, 'player1').includes('Rejected Sneak Spell'));
  assert.ok(!handNames(state, 'player1').includes('Rejected Sneak Attacker'));
});

test('sneaked creatures enter tapped and attacking the returned attacker defender', async () => {
  const attacker = createCreature('Sneak Carrier', 2, 2);
  const sneakCreature = CardBuilder.create('Ninja Reinforcement')
    .cost('{4}{R}')
    .types(CardType.CREATURE)
    .stats(4, 4)
    .sneak('{1}{R}')
    .build();
  const walker = createPlaneswalker('Sneak Walker', 5);
  const battle = createBattle('Sneak Siege', 4);

  const runCase = async (targetType: 'player' | 'planeswalker' | 'battle') => {
    const { state, engine } = createHarness({
      decks: [
        { commander: makeCommander('Sneak Commander', '{R}'), cards: [attacker, sneakCreature], playerName: 'Sneak Player' },
        { commander: makeCommander('Defense Commander', '{W}'), cards: [walker, battle], playerName: 'Defender' },
        { commander: makeCommander('Protector Commander', '{G}'), cards: [], playerName: 'Protector' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Sneak Carrier' }, Zone.BATTLEFIELD)
          .setBattlefieldCard({ playerId: 'player1', name: 'Sneak Carrier' }, { summoningSick: false })
          .moveCard({ playerId: 'player1', name: 'Ninja Reinforcement' }, Zone.HAND)
          .setTurn({
            activePlayer: 'player1',
            currentPhase: Phase.COMBAT,
            currentStep: Step.DECLARE_BLOCKERS,
            priorityPlayer: 'player1',
            passedPriority: [],
          });

        if (targetType === 'planeswalker') {
          builder
            .moveCard({ playerId: 'player2', name: 'Sneak Walker' }, Zone.BATTLEFIELD)
            .setBattlefieldCard({ playerId: 'player2', name: 'Sneak Walker' }, { counters: { loyalty: 5 } });
        }

        if (targetType === 'battle') {
          builder
            .moveCard({ playerId: 'player2', name: 'Sneak Siege' }, Zone.BATTLEFIELD)
            .setBattlefieldCard({ playerId: 'player2', name: 'Sneak Siege' }, {
              counters: { defense: 4 },
              battleProtector: 'player3',
            });
        }

        builder.mutateState((game) => {
          const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Sneak Carrier');
          assert.ok(attackingCreature);

          const defender = targetType === 'player'
            ? { type: 'player' as const, id: 'player2' }
            : targetType === 'planeswalker'
              ? {
                type: 'planeswalker' as const,
                id: game.zones.player2.BATTLEFIELD.find((card) => card.definition.name === 'Sneak Walker')!.objectId,
              }
              : {
                type: 'battle' as const,
                id: game.zones.player2.BATTLEFIELD.find((card) => card.definition.name === 'Sneak Siege')!.objectId,
              };

          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackingCreature.objectId, defender]]),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
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

    engine.addMana('player1', 'R', 1);
    engine.addMana('player1', 'C', 1);
    const sneakCardId = getCard(state, 'player1', Zone.HAND, 'Ninja Reinforcement').objectId;
    const returnedAttackerId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Sneak Carrier').objectId;
    const expectedDefender = state.combat!.attackers.get(returnedAttackerId);

    await internalEngine.handleCastSpell('player1', sneakCardId, [], undefined, undefined, undefined, undefined, 'sneak');
    await internalEngine.resolveTopOfStack();

    const sneakedCreature = getCard(state, 'player1', Zone.BATTLEFIELD, 'Ninja Reinforcement');
    assert.equal(sneakedCreature.tapped, true);
    assert.ok(handNames(state, 'player1').includes('Sneak Carrier'));
    assert.equal(state.combat?.attackers.has(returnedAttackerId), false);
    assert.deepEqual(state.combat?.attackers.get(sneakedCreature.objectId), expectedDefender);
    assert.equal(
      state.eventLog.some((event) => event.type === 'ATTACKS' && event.attackerId === sneakedCreature.objectId),
      false,
    );
  };

  await runCase('player');
  await runCase('planeswalker');
  await runCase('battle');
});

test('noncreature spells can branch on sneak cast method', async () => {
  const attacker = createCreature('Sneak Spell Carrier', 2, 2);
  const sneakSpell = CardBuilder.create('Pocket Sand')
    .cost('{3}{R}')
    .types(CardType.SORCERY)
    .sneak('{1}{R}')
    .spellEffect((ctx) => {
      ctx.game.loseLife('player2', ctx.castMethod === 'sneak' ? 3 : 1);
    })
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Sneak Commander', '{R}'), cards: [attacker, sneakSpell], playerName: 'Sneak Player' },
      { commander: makeCommander('Defense Commander', '{W}'), cards: [], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Sneak Spell Carrier' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Sneak Spell Carrier' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Pocket Sand' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_BLOCKERS,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Sneak Spell Carrier');
          assert.ok(attackingCreature);
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackingCreature.objectId, { type: 'player', id: 'player2' }]]),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
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

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'C', 1);
  await internalEngine.handleCastSpell(
    'player1',
    getCard(state, 'player1', Zone.HAND, 'Pocket Sand').objectId,
    [],
    undefined,
    undefined,
    undefined,
    undefined,
    'sneak',
  );
  await internalEngine.resolveTopOfStack();

  assert.equal(state.players.player2.life, 37);
  assert.ok(graveyardNames(state, 'player1').includes('Pocket Sand'));
  assert.ok(handNames(state, 'player1').includes('Sneak Spell Carrier'));
});

test('declare blockers starts a fresh priority round with the active player', async () => {
  const attacker = createCreature('Priority Attacker', 2, 2);
  const blocker = createCreature('Priority Blocker', 2, 2);
  const responseSpell = CardBuilder.create('Priority Trick')
    .cost('{W}')
    .types(CardType.INSTANT)
    .build();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Attack Commander', '{R}'), cards: [attacker, responseSpell], playerName: 'Attacker' },
      { commander: makeCommander('Defense Commander', '{W}'), cards: [blocker], playerName: 'Defender' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Priority Attacker' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Priority Attacker' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Priority Trick' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Priority Blocker' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Priority Blocker' }, { summoningSick: false })
        .setPlayer('player1', { manaPool: { W: 1 } })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.COMBAT,
          currentStep: Step.DECLARE_BLOCKERS,
          priorityPlayer: 'player2',
          passedPriority: ['player1'],
        })
        .mutateState((game) => {
          const attackingCreature = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Priority Attacker');
          const blockingCreature = game.zones.player2.BATTLEFIELD.find((card) => card.definition.name === 'Priority Blocker');
          assert.ok(attackingCreature);
          assert.ok(blockingCreature);
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackingCreature.objectId, { type: 'player', id: 'player2' }]]),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  await engine.submitAction({
    type: ActionType.DECLARE_BLOCKERS,
    playerId: 'player2',
    blockers: [{
      blockerId: getCard(state, 'player2', Zone.BATTLEFIELD, 'Priority Blocker').objectId,
      attackerId: getCard(state, 'player1', Zone.BATTLEFIELD, 'Priority Attacker').objectId,
    }],
  });

  assert.equal(state.priorityPlayer, 'player1');
  assert.deepEqual([...state.passedPriority], []);
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
