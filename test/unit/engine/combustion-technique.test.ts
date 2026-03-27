import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { CombustionTechnique } from '../../../src/cards/sets/starter/spells.ts';
import { markExileInsteadOfDyingThisTurn } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createHarness, battlefieldNames, getCard, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeVanillaCreature(name: string, power = 2, toughness = 2) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeLessonCard(name: string) {
  return CardBuilder.create(name)
    .types(CardType.SORCERY)
    .subtypes('Lesson')
    .build();
}

function makeFillerCards(prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) =>
    CardBuilder.create(`${prefix} Filler ${index + 1}`)
      .types(CardType.SORCERY)
      .build()
  );
}

async function castCombustionTechnique(options: {
  lessonsInGraveyard?: number;
  targetPower?: number;
  targetToughness?: number;
  targetName?: string;
}) {
  const lessonsInGraveyard = options.lessonsInGraveyard ?? 0;
  const targetPower = options.targetPower ?? 2;
  const targetToughness = options.targetToughness ?? 5;
  const targetName = options.targetName ?? 'Target Dummy';

  const lessonCards = Array.from({ length: lessonsInGraveyard }, (_, index) =>
    makeLessonCard(`Lesson ${index + 1}`)
  );
  const targetCreature = makeVanillaCreature(targetName, targetPower, targetToughness);
  const techniqueFiller = makeFillerCards('Technique', 8);
  const targetFiller = makeFillerCards('Target', 8);
  const p3Filler = makeFillerCards('P3', 8);
  const p4Filler = makeFillerCards('P4', 8);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Technique Commander', '{R}'),
        cards: [CombustionTechnique, ...lessonCards, ...techniqueFiller],
        playerName: 'Technique',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [targetCreature, ...targetFiller],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: p3Filler, playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: p4Filler, playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Combustion Technique' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: targetName }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: targetName }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
      for (let i = 0; i < lessonsInGraveyard; i++) {
        builder.moveCard({ playerId: 'player1', name: `Lesson ${i + 1}` }, Zone.GRAVEYARD);
      }
    },
  });

  engine.addMana('player1', 'R', 1);
  engine.addMana('player1', 'C', 1);

  const targetCard = getCard(state, 'player2', Zone.BATTLEFIELD, targetName);
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Combustion Technique').objectId,
    targets: [targetCard.objectId],
  });
  await settleEngine();

  return { state, engine, targetCard, targetName };
}

test('Combustion Technique deals 2 plus Lesson cards in your graveyard and does not count itself', async () => {
  const runCase = async (lessonsInGraveyard: number, expectedDamage: number) => {
    const { state } = await castCombustionTechnique({ lessonsInGraveyard });
    const damageEvent = [...state.eventLog].reverse().find((event) =>
      event.type === 'DAMAGE_DEALT' &&
      event.targetId === getCard(state, 'player2', Zone.BATTLEFIELD, 'Target Dummy').objectId
    );

    assert.equal(damageEvent && 'amount' in damageEvent ? damageEvent.amount : undefined, expectedDamage);
    assert.ok(graveyardNames(state, 'player1').includes('Combustion Technique'));
    assert.ok(battlefieldNames(state, 'player2').includes('Target Dummy'));
  };

  await runCase(0, 2);
  await runCase(1, 3);
  await runCase(2, 4);
});

test('Combustion Technique exiles a creature that would die this turn and suppresses dies triggers', async () => {
  const doomedCreature = CardBuilder.create('Doomed Student')
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(2, 2)
    .triggered(
      { on: 'dies', filter: { self: true } },
      (ctx) => {
        ctx.game.gainLife(ctx.controller, 5);
      },
      { description: 'When this creature dies, you gain 5 life.' },
    )
    .build();
  const techniqueFiller = makeFillerCards('Technique', 8);
  const targetFiller = makeFillerCards('Target', 8);
  const p3Filler = makeFillerCards('P3', 8);
  const p4Filler = makeFillerCards('P4', 8);

  const { state, engine } = createHarness({
    decks: [
      {
        commander: makeCommander('Technique Commander', '{R}'),
        cards: [CombustionTechnique, makeLessonCard('Lesson A'), ...techniqueFiller],
        playerName: 'Technique',
      },
      {
        commander: makeCommander('Target Commander', '{G}'),
        cards: [doomedCreature, ...targetFiller],
        playerName: 'Target',
      },
      { commander: makeCommander('P3 Commander', '{2}'), cards: p3Filler, playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: p4Filler, playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Combustion Technique' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Doomed Student' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Doomed Student' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Lesson A' }, Zone.GRAVEYARD)
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

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Doomed Student').objectId;
  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Combustion Technique').objectId,
    targets: [targetId],
  });
  await settleEngine();

  assert.ok(graveyardNames(state, 'player2').every((name) => name !== 'Doomed Student'));
  assert.ok(state.zones.player2.EXILE.some((card) => card.definition.name === 'Doomed Student'));
  assert.equal(state.players.player2.life, 40);
});

test('Combustion Technique keeps its exile replacement for the rest of the turn', async () => {
  const { state, engine } = await castCombustionTechnique({
    lessonsInGraveyard: 0,
    targetPower: 3,
    targetToughness: 4,
    targetName: 'Persistent Target',
  });

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Persistent Target').objectId;
  assert.ok(graveyardNames(state, 'player1').includes('Combustion Technique'));
  const targetCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Persistent Target');
  markExileInsteadOfDyingThisTurn(state, targetId, targetCard.zoneChangeCounter);
  targetCard.exileInsteadOfDyingThisTurnZoneChangeCounter = targetCard.zoneChangeCounter;

  engine.destroyPermanent(targetId);
  await settleEngine();

  assert.ok(graveyardNames(state, 'player2').every((name) => name !== 'Persistent Target'));
  assert.ok(state.zones.player2.EXILE.some((card) => card.definition.name === 'Persistent Target'));
});

test('cleanup clears Combustion Technique exile markers', async () => {
  const { state, engine } = await castCombustionTechnique({
    lessonsInGraveyard: 0,
    targetPower: 3,
    targetToughness: 4,
    targetName: 'Cleanup Target',
  });

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Cleanup Target').objectId;
  const targetCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Cleanup Target');
  markExileInsteadOfDyingThisTurn(state, targetId, targetCard.zoneChangeCounter);
  targetCard.exileInsteadOfDyingThisTurnZoneChangeCounter = targetCard.zoneChangeCounter;
  engine.endTurn();

  assert.equal(state.exileInsteadOfDyingThisTurn.size, 0);
  assert.equal(targetCard.exileInsteadOfDyingThisTurnZoneChangeCounter, undefined);

  engine.destroyPermanent(targetId);
  await settleEngine();

  assert.ok(graveyardNames(state, 'player2').includes('Cleanup Target'));
  assert.ok(state.zones.player2.EXILE.every((card) => card.definition.name !== 'Cleanup Target'));
});

test('Combustion Technique marks only the original object instance', async () => {
  const { state, engine } = await castCombustionTechnique({
    lessonsInGraveyard: 0,
    targetPower: 3,
    targetToughness: 4,
    targetName: 'Scoped Target',
  });

  const targetId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Scoped Target').objectId;
  const targetCard = getCard(state, 'player2', Zone.BATTLEFIELD, 'Scoped Target');
  markExileInsteadOfDyingThisTurn(state, targetId, targetCard.zoneChangeCounter);
  targetCard.exileInsteadOfDyingThisTurnZoneChangeCounter = targetCard.zoneChangeCounter;

  engine.moveCard(targetId, Zone.HAND, 'player2');
  engine.moveCard(targetId, Zone.BATTLEFIELD, 'player2');
  assert.equal(
    getCard(state, 'player2', Zone.BATTLEFIELD, 'Scoped Target').exileInsteadOfDyingThisTurnZoneChangeCounter,
    undefined,
  );
  engine.destroyPermanent(targetId);
  await settleEngine();

  assert.ok(graveyardNames(state, 'player2').includes('Scoped Target'));
  assert.ok(state.zones.player2.EXILE.every((card) => card.definition.name !== 'Scoped Target'));
});
