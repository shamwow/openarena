import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { EarthRumble } from '../../../src/cards/sets/starter/spells.ts';
import { hasType } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import { createHarness, getCard, graveyardNames, makeCommander, settleEngine } from './helpers.ts';

function makeLand(name: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes('Forest')
    .build();
}

function makeCreature(name: string, power: number, toughness: number) {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeManaLand(name: string) {
  return CardBuilder.create(name)
    .types(CardType.LAND)
    .subtypes('Forest')
    .tapForMana('G')
    .build();
}

function makeSpell(name: string, cost = '{G}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.SORCERY)
    .build();
}

function findOptionByName(options: unknown[], name: string) {
  return options.find((option) =>
    typeof option === 'object' &&
    option !== null &&
    'definition' in option &&
    typeof option.definition === 'object' &&
    option.definition !== null &&
    'name' in option.definition &&
    option.definition.name === name,
  );
}

function createEarthRumbleChoiceResponder(config: {
  landName: string;
  yourCreatureName?: string;
  opposingCreatureName?: string;
}) {
  return (request: ChoiceRequest): void => {
    if (request.type === 'chooseOne' && request.prompt.includes('Choose a land you control')) {
      request.resolve(findOptionByName(request.options, config.landName) ?? request.options[0]);
      return;
    }

    if (request.type === 'chooseUpToN' && request.prompt.includes('Choose up to one creature you control to fight')) {
      if (!config.yourCreatureName) {
        request.resolve([]);
        return;
      }

      const chosen = findOptionByName(request.options, config.yourCreatureName);
      request.resolve(chosen ? [chosen] : []);
      return;
    }

    if (request.type === 'chooseOne' && request.prompt.includes('Choose a creature an opponent controls to fight')) {
      request.resolve(findOptionByName(request.options, config.opposingCreatureName ?? '') ?? request.options[0]);
      return;
    }

    if (request.type === 'chooseYesNo') {
      request.resolve(true);
      return;
    }

    if (request.type === 'chooseN' || request.type === 'chooseUpToN') {
      request.resolve(request.options.slice(0, request.count ?? 0));
      return;
    }

    if (request.type === 'choosePlayer' || request.type === 'orderObjects') {
      request.resolve(request.options);
      return;
    }

    request.resolve(request.options);
  };
}

test('Earth Rumble can use the newly earthbent land in the fight', async () => {
  const rumbleGrove = makeLand('Rumble Grove');
  const safeguardForest = makeManaLand('Safeguard Forest');
  const opposingCreature = makeCreature('Rumble Foe', 2, 2);
  const followUpSpell = makeSpell('Follow-Up Lesson');

  const { state, engine } = createHarness({
    choiceResponder: createEarthRumbleChoiceResponder({
      landName: 'Rumble Grove',
      yourCreatureName: 'Rumble Grove',
      opposingCreatureName: 'Rumble Foe',
    }),
    decks: [
      {
        commander: makeCommander('Earth Commander', '{G}'),
        cards: [EarthRumble, rumbleGrove, safeguardForest, followUpSpell],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [opposingCreature], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earth Rumble' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Follow-Up Lesson' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Rumble Grove' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Safeguard Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Rumble Foe' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Rumble Foe' }, { summoningSick: false })
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
  engine.addMana('player1', 'C', 3);

  const groveId = getCard(state, 'player1', Zone.BATTLEFIELD, 'Rumble Grove').objectId;
  const foeId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Rumble Foe').objectId;

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Earth Rumble').objectId,
  });
  await settleEngine();

  const returnedGrove = getCard(state, 'player1', Zone.BATTLEFIELD, 'Rumble Grove');
  const landDamageEvent = state.eventLog.find((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.sourceId === groveId &&
    event.targetId === foeId,
  );

  assert.equal(landDamageEvent?.amount, 2);
  assert.equal(returnedGrove.tapped, true);
  assert.equal(hasType(returnedGrove, CardType.CREATURE), false);
  assert.equal(graveyardNames(state, 'player2').includes('Rumble Foe'), true);
  assert.equal(graveyardNames(state, 'player1').includes('Earth Rumble'), true);
});

test('Earth Rumble can skip the optional friendly creature and still earthbend', async () => {
  const quietGrove = makeLand('Quiet Grove');
  const safeguardForest = makeManaLand('Steady Forest');
  const opposingCreature = makeCreature('Watching Foe', 2, 2);
  const followUpSpell = makeSpell('Aftershock Study');

  const { state, engine } = createHarness({
    choiceResponder: createEarthRumbleChoiceResponder({
      landName: 'Quiet Grove',
    }),
    decks: [
      {
        commander: makeCommander('Earth Commander', '{G}'),
        cards: [EarthRumble, quietGrove, safeguardForest, followUpSpell],
        playerName: 'Earth',
      },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [opposingCreature], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Earth Rumble' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Aftershock Study' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Quiet Grove' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Steady Forest' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player2', name: 'Watching Foe' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Watching Foe' }, { summoningSick: false })
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
  engine.addMana('player1', 'C', 3);

  const foeId = getCard(state, 'player2', Zone.BATTLEFIELD, 'Watching Foe').objectId;

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: getCard(state, 'player1', Zone.HAND, 'Earth Rumble').objectId,
  });
  await settleEngine();

  const earthbentLand = getCard(state, 'player1', Zone.BATTLEFIELD, 'Quiet Grove');
  const damageToFoe = state.eventLog.some((event) =>
    event.type === 'DAMAGE_DEALT' &&
    event.targetId === foeId,
  );

  assert.equal(hasType(earthbentLand, CardType.CREATURE), true);
  assert.equal(earthbentLand.counters['+1/+1'], 2);
  assert.equal(damageToFoe, false);
  assert.equal(getCard(state, 'player2', Zone.BATTLEFIELD, 'Watching Foe').zone, Zone.BATTLEFIELD);
  assert.equal(graveyardNames(state, 'player1').includes('Earth Rumble'), true);
});
