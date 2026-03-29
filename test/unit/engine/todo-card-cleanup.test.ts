import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ThatsRoughBuddy } from '../../../src/cards/sets/TLE/thats-rough-buddy.ts';
import { WaterbendingLesson } from '../../../src/cards/sets/TLA/waterbending-lesson.ts';
import { TophHardheadedTeacher } from '../../../src/cards/sets/TLA/toph-hardheaded-teacher.ts';
import { ElementalTeachings } from '../../../src/cards/sets/TLA/elemental-teachings.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import { battlefieldNames, createHarness, getCard, getLegalAction, graveyardNames, handNames, makeCommander, settleEngine } from './helpers.ts';

function makeCreature(name: string, cost = '{1}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

function makeSpell(name: string, cost = '{1}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.SORCERY)
    .spellEffect(() => {})
    .build();
}

function makeLand(name: string, subtype?: string) {
  const builder = CardBuilder.create(name)
    .types(CardType.LAND);

  if (subtype) {
    builder.subtypes(subtype);
  }

  return builder.build();
}

function getCardName(option: unknown): string | undefined {
  if (typeof option !== 'object' || option === null) return undefined;
  if (!('definition' in option)) return undefined;
  const definition = (option as { definition?: { name?: string } }).definition;
  return definition?.name;
}

function findOptionByName(options: unknown[], name: string): unknown | undefined {
  return options.find((option) => getCardName(option) === name);
}

function createElementalTeachingsResponder() {
  return (request: ChoiceRequest): void => {
    if (request.type === 'chooseUpToN' && request.prompt.includes('Search your library for up to four land cards with different names')) {
      request.resolve([
        findOptionByName(request.options, 'Ashen Dunes'),
        findOptionByName(request.options, 'Blue Mesa'),
        findOptionByName(request.options, 'Crimson Vale'),
        findOptionByName(request.options, 'Dawn Ridge'),
      ].filter((option): option is unknown => Boolean(option)));
      return;
    }

    if (request.type === 'choosePlayer' && request.prompt.includes('Choose an opponent to choose from the revealed lands')) {
      request.resolve(request.options[0]);
      return;
    }

    if (request.type === 'chooseN' && request.prompt.includes("Search Teachings Player's library")) {
      request.resolve([
        findOptionByName(request.options, 'Ashen Dunes'),
        findOptionByName(request.options, 'Crimson Vale'),
      ].filter((option): option is unknown => Boolean(option)));
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

test("That's Rough Buddy adds two counters after a creature you control left the battlefield this turn", async () => {
  const targetCreature = makeCreature('Battle Trainee');
  const departedCreature = makeCreature('Fallen Scout');
  const drawFiller = makeSpell('Draw Filler');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Rough Commander', '{W}'), cards: [ThatsRoughBuddy, targetCreature, departedCreature, drawFiller], playerName: 'Rough Player' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: "That's Rough Buddy" }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Battle Trainee' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Fallen Scout' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.moveCard(getCard(state, 'player1', Zone.BATTLEFIELD, 'Fallen Scout').objectId, Zone.GRAVEYARD, 'player1');
  engine.addMana('player1', 'W', 1);
  engine.addMana('player1', 'C', 1);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, "That's Rough Buddy").objectId,
  });
  await settleEngine();

  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Battle Trainee').counters['+1/+1'], 2);
});

test('Waterbending Lesson branches on whether its optional waterbend cost was paid', async () => {
  const supportCard = makeSpell('Support Notes', '{1}');
  const supportA = makeCreature('River Adept');
  const supportB = makeCreature('Canal Adept');
  const drawOne = makeSpell('Reference One');
  const drawTwo = makeSpell('Reference Two');
  const drawThree = makeSpell('Reference Three');

  const runCase = async (payWaterbend: boolean) => {
    const { state, engine } = createHarness({
      decks: [
        {
          commander: makeCommander('Water Commander', '{U}'),
          cards: [WaterbendingLesson, supportCard, supportA, supportB, drawOne, drawTwo, drawThree],
          playerName: 'Water Player',
        },
        { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
        { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Waterbending Lesson' }, Zone.HAND)
          .moveCard({ playerId: 'player1', name: 'Support Notes' }, Zone.HAND)
          .moveCard({ playerId: 'player1', name: 'River Adept' }, Zone.BATTLEFIELD)
          .moveCard({ playerId: 'player1', name: 'Canal Adept' }, Zone.BATTLEFIELD)
          .setBattlefieldCard({ playerId: 'player1', name: 'River Adept' }, { summoningSick: false })
          .setBattlefieldCard({ playerId: 'player1', name: 'Canal Adept' }, { summoningSick: false })
          .setTurn({
            activePlayer: 'player1',
            currentPhase: Phase.PRECOMBAT_MAIN,
            currentStep: Step.MAIN,
            priorityPlayer: 'player1',
            passedPriority: [],
          });
      },
      choiceResponder: (request) => {
        if (request.type === 'chooseYesNo' && request.prompt.includes('Pay additional cost Waterbend {2}?')) {
          request.resolve(payWaterbend);
          return;
        }
        if (request.type === 'chooseOne' && request.prompt.includes('Discard a card')) {
          request.resolve(findOptionByName(request.options, 'Support Notes') ?? request.options[0]);
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
    engine.addMana('player1', 'C', 3);

    await engine.submitAction({
      type: ActionType.CAST_SPELL,
      playerId: 'player1',
      cardId: getCard(state, 'player1', Zone.HAND, 'Waterbending Lesson').objectId,
    });
    await settleEngine();

    return {
      graveyard: graveyardNames(state, 'player1'),
      handSize: handNames(state, 'player1').length,
    };
  };

  const unpaid = await runCase(false);
  const paid = await runCase(true);

  assert.equal(unpaid.graveyard.includes('Support Notes'), true);
  assert.equal(paid.graveyard.includes('Support Notes'), false);
  assert.equal(unpaid.handSize, 3);
  assert.equal(paid.handSize, 4);
});

test('Toph, Hardheaded Teacher earthbends 2 when you cast a Lesson and 1 otherwise', async () => {
  const lesson = CardBuilder.create('Lesson Draft')
    .cost('{G}')
    .types(CardType.SORCERY)
    .subtypes('Lesson')
    .spellEffect(() => {})
    .build();
  const nonLesson = makeSpell('Ordinary Lecture', '{G}');
  const forest = makeLand('Practice Forest', 'Forest');

  const runCase = async (spellName: 'Lesson Draft' | 'Ordinary Lecture') => {
    const { state, engine } = createHarness({
      decks: [
        { commander: makeCommander('Toph Commander', '{R}{G}'), cards: [TophHardheadedTeacher, lesson, nonLesson, forest], playerName: 'Toph Player' },
        { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
        { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
        { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
      ],
      setup: (builder) => {
        builder
          .moveCard({ playerId: 'player1', name: 'Toph, Hardheaded Teacher' }, Zone.BATTLEFIELD)
          .moveCard({ playerId: 'player1', name: 'Practice Forest' }, Zone.BATTLEFIELD)
          .moveCard({ playerId: 'player1', name: spellName }, Zone.HAND)
          .setBattlefieldCard({ playerId: 'player1', name: 'Toph, Hardheaded Teacher' }, { summoningSick: false })
          .setTurn({
            activePlayer: 'player1',
            currentPhase: Phase.PRECOMBAT_MAIN,
            currentStep: Step.MAIN,
            priorityPlayer: 'player1',
            passedPriority: [],
          });
      },
    });

    engine.addMana('player1', 'G', 1);

    await engine.submitAction(getLegalAction(
      engine,
      'player1',
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === getCard(state, 'player1', Zone.HAND, spellName).objectId,
    ));
    await settleEngine();

    return getCard(state, 'player1', Zone.BATTLEFIELD, 'Practice Forest').counters['+1/+1'] ?? 0;
  };

  assert.equal(await runCase('Ordinary Lecture'), 1);
  assert.equal(await runCase('Lesson Draft'), 2);
});

test('TLA Elemental Teachings keeps different land names and lets an opponent choose two', async () => {
  const ashenDunes = makeLand('Ashen Dunes');
  const blueMesa = makeLand('Blue Mesa');
  const crimsonVale = makeLand('Crimson Vale');
  const dawnRidge = makeLand('Dawn Ridge');
  const emeraldThicket = makeLand('Emerald Thicket');
  const ashenDunesCopy = makeLand('Ashen Dunes');

  const { state, engine } = createHarness({
    choiceResponder: createElementalTeachingsResponder(),
    decks: [
      {
        commander: makeCommander('Teachings Commander', '{G}'),
        cards: [ElementalTeachings, ashenDunes, blueMesa, crimsonVale, dawnRidge, emeraldThicket, ashenDunesCopy],
        playerName: 'Teachings Player',
      },
      { commander: makeCommander('Opponent Commander', '{2}'), cards: [], playerName: 'Support Opponent' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Elemental Teachings' }, Zone.HAND)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  engine.addMana('player1', 'G', 1);
  engine.addMana('player1', 'C', 4);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Elemental Teachings').objectId,
  });
  await settleEngine();

  assert.deepEqual(
    graveyardNames(state, 'player1').sort(),
    ['Ashen Dunes', 'Crimson Vale', 'Elemental Teachings'].sort(),
  );
  assert.deepEqual(
    battlefieldNames(state, 'player1').sort(),
    ['Blue Mesa', 'Dawn Ridge'].sort(),
  );
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Blue Mesa').tapped, true);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Dawn Ridge').tapped, true);
  assert.equal(state.zones.player1.LIBRARY.filter((card) => card.definition.name === 'Ashen Dunes').length, 1);
  assert.equal(state.zones.player1.LIBRARY.some((card) => card.definition.name === 'Emerald Thicket'), true);
});
