import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { ElementalTeachings } from '../../../src/cards/sets/starter/spells.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import { battlefieldNames, createHarness, getCard, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeLand(name: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .build();
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

function createChoiceResponder() {
  return (request: ChoiceRequest): void => {
    if (request.type === 'chooseUpToN' && request.prompt.includes('Search your library for up to four land cards with different names')) {
      const names = request.options.map(getCardName).filter((name): name is string => Boolean(name));
      assert.equal(new Set(names).size, names.length);
      assert.equal(names.length, 5);
      assert.equal(names.filter((name) => name === 'Ashen Dunes').length, 1);
      assert.equal(names.includes('Emerald Thicket'), true);

      request.resolve([
        findOptionByName(request.options, 'Ashen Dunes'),
        findOptionByName(request.options, 'Blue Mesa'),
        findOptionByName(request.options, 'Crimson Vale'),
        findOptionByName(request.options, 'Dawn Ridge'),
      ].filter((option): option is unknown => Boolean(option)));
      return;
    }

    if (request.type === 'choosePlayer' && request.prompt.includes('Choose an opponent to choose from the revealed lands')) {
      assert.match(request.prompt, /^\[Teachings Player\]/);
      request.resolve(request.options[0]);
      return;
    }

    if (request.type === 'chooseN' && request.prompt.includes("Search Teachings Player's library")) {
      assert.match(request.prompt, /^\[Support Opponent\]/);
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

test('Elemental Teachings keeps different land names, lets an opponent choose two, and taps the rest', async () => {
  const ashenDunes = makeLand('Ashen Dunes');
  const blueMesa = makeLand('Blue Mesa');
  const crimsonVale = makeLand('Crimson Vale');
  const dawnRidge = makeLand('Dawn Ridge');
  const emeraldThicket = makeLand('Emerald Thicket');
  const ashenDunesCopy = makeLand('Ashen Dunes');

  const { state, engine } = createHarness({
    choiceResponder: createChoiceResponder(),
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
