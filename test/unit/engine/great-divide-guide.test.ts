import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { GreatDivideGuide } from '../../../src/cards/sets/starter/creatures.ts';
import { Forest } from '../../../src/cards/sets/starter/lands.ts';
import { GameEngineImpl, type ChoiceRequest } from '../../../src/engine/GameEngine.ts';
import { getEffectiveAbilities } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import { createTestGameStateBuilder } from '../../../src/testing/testGameStateBuilder.ts';
import { getCard, makeCommander, settleEngine } from './helpers.ts';

function makeBlueTestSpell() {
  return CardBuilder.create('Blue Test Spell')
    .cost('{U}')
    .types(CardType.INSTANT)
    .spellEffect(() => {}, { description: 'Resolve a blue test spell.' })
    .build();
}

function chooseBlueMana(request: ChoiceRequest): void {
  if (request.type === 'chooseOne' && request.prompt.includes('Choose a color of mana to add')) {
    request.resolve('U');
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
}

test('Great Divide Guide grants any-color tap abilities to lands and Allies and enables blue spell planning', async () => {
  const blueTestSpell = makeBlueTestSpell();
  const builder = createTestGameStateBuilder([
    {
      commander: makeCommander('Guide Commander', '{G}{U}'),
      cards: [GreatDivideGuide, Forest, blueTestSpell],
      playerName: 'Guide Player',
    },
    { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
    { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
    { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
  ]);

  builder
    .moveCard({ playerId: 'player1', name: 'Great Divide Guide' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Great Divide Guide' }, { summoningSick: false })
    .moveCard({ playerId: 'player1', name: 'Forest' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player1', name: 'Blue Test Spell' }, Zone.HAND)
    .setTurn({
      activePlayer: 'player1',
      currentPhase: Phase.PRECOMBAT_MAIN,
      currentStep: Step.MAIN,
      priorityPlayer: 'player1',
      passedPriority: [],
    });

  const state = builder.build();
  const engine = new GameEngineImpl({
    initialState: state,
    drawOpeningHands: false,
    runGameLoopOnInit: true,
  });
  engine.onChoiceRequest(chooseBlueMana);
  await settleEngine();

  const forest = getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest');
  const guide = getCard(state, 'player1', Zone.BATTLEFIELD, 'Great Divide Guide');
  const blueSpellId = getCard(state, 'player1', Zone.HAND, 'Blue Test Spell').objectId;

  const forestAbilities = getEffectiveAbilities(forest);
  const forestAnyColorIndex = forestAbilities.findIndex(
    (ability) => ability.kind === 'activated' && ability.description === '{T}: Add one mana of any color.',
  );
  assert.notEqual(forestAnyColorIndex, -1);
  assert.equal(
    forestAbilities.filter((ability) => ability.kind === 'activated').length,
    2,
  );

  const guideAbilities = getEffectiveAbilities(guide);
  const guideAnyColorIndex = guideAbilities.findIndex(
    (ability) => ability.kind === 'activated' && ability.description === '{T}: Add one mana of any color.',
  );
  assert.notEqual(guideAnyColorIndex, -1);

  const legalActions = engine.getLegalActions('player1');
  assert.equal(
    legalActions.some(
      (action) => action.type === ActionType.CAST_SPELL && action.cardId === blueSpellId,
    ),
    true,
  );
  assert.equal(
    legalActions.some(
      (action) => (
        action.type === ActionType.ACTIVATE_ABILITY &&
        action.sourceId === guide.objectId &&
        action.abilityIndex === guideAnyColorIndex
      ),
    ),
    true,
  );

  await engine.submitAction({
    type: ActionType.ACTIVATE_ABILITY,
    playerId: 'player1',
    sourceId: forest.objectId,
    abilityIndex: forestAnyColorIndex,
  });
  await settleEngine();

  assert.equal(state.players.player1.manaPool.U, 1);
  assert.equal(getCard(state, 'player1', Zone.BATTLEFIELD, 'Forest').tapped, true);
});
