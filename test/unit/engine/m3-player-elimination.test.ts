import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { cloneCardInstance, getNextTimestamp } from '../../../src/engine/GameState.ts';
import { ActionType, CardType, GameEventType, Phase, StackEntryType, Step, Zone, type CardDefinition } from '../../../src/engine/types.ts';
import { BloodArtist } from '../../../src/cards/sets/starter/creatures.ts';
import { createHarness, makeCommander, settleEngine } from './helpers.ts';

function makeVanillaCreature(name: string, power = 2, toughness = 2): CardDefinition {
  return CardBuilder.create(name)
    .cost('{2}')
    .types(CardType.CREATURE)
    .stats(power, toughness)
    .build();
}

function makeLoseLifeSpell(name: string, targetPlayer: 'player1' | 'player2' | 'player3' | 'player4', amount: number): CardDefinition {
  return CardBuilder.create(name)
    .cost('{1}')
    .types(CardType.INSTANT)
    .spellEffect((ctx) => {
      ctx.game.loseLife(targetPlayer, amount);
    })
    .build();
}

function makeNoopSpell(name: string): CardDefinition {
  return CardBuilder.create(name)
    .cost('{1}')
    .types(CardType.INSTANT)
    .spellEffect(() => {})
    .build();
}

function pushSpellOnStack(
  state: ReturnType<typeof createHarness>['state'],
  playerId: 'player1' | 'player2' | 'player3' | 'player4',
  name: string,
): void {
  const hand = state.zones[playerId].HAND;
  const index = hand.findIndex((card) => card.definition.name === name);
  assert.notEqual(index, -1, `Expected ${name} in ${playerId}.HAND.`);
  const card = hand.splice(index, 1)[0];
  card.zone = Zone.STACK;
  card.zoneChangeCounter += 1;
  card.timestamp = getNextTimestamp(state);

  state.stack.push({
    id: `${card.objectId}-stack`,
    entryType: StackEntryType.SPELL,
    sourceId: card.objectId,
    sourceCardId: card.cardId,
    sourceZoneChangeCounter: card.zoneChangeCounter,
    sourceSnapshot: cloneCardInstance(card),
    controller: playerId,
    timestamp: getNextTimestamp(state),
    targets: [],
    targetZoneChangeCounters: [],
    cardInstance: card,
    spellDefinition: card.definition,
    resolve: () => {},
  });
}

test('elimination during combat removes the defending player from turn order and battlefield state', async () => {
  const attacker = makeVanillaCreature('Combat Threat', 3, 3);
  const defenderPermanent = makeVanillaCreature('Defender Permanent', 2, 2);
  const stopperSpell = makeNoopSpell('Combat Stopper');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Combat Commander'), cards: [attacker, stopperSpell], playerName: 'Aggro' },
      { commander: makeCommander('Defender Commander'), cards: [defenderPermanent], playerName: 'Defender' },
      { commander: makeCommander('Support Commander A'), cards: [], playerName: 'Support A' },
      { commander: makeCommander('Support Commander B'), cards: [], playerName: 'Support B' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Combat Threat' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Combat Threat' }, { summoningSick: false })
        .moveCard({ playerId: 'player1', name: 'Combat Stopper' }, Zone.HAND)
        .setPlayer('player1', { manaPool: { C: 1 } })
        .moveCard({ playerId: 'player2', name: 'Defender Permanent' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Defender Permanent' }, { summoningSick: false })
        .setPlayer('player2', { life: 3 })
        .mutateState((game) => {
          const attackerCard = game.zones.player1.BATTLEFIELD.find((card) => card.definition.name === 'Combat Threat');
          assert.ok(attackerCard);
          game.currentPhase = Phase.COMBAT;
          game.currentStep = Step.COMBAT_DAMAGE;
          game.activePlayer = 'player1';
          game.priorityPlayer = 'player1';
          game.passedPriority = new Set();
          game.combat = {
            attackingPlayer: 'player1',
            attackers: new Map([[attackerCard.objectId, { type: 'player', id: 'player2' }]]),
            blockers: new Map(),
            blockerOrder: new Map(),
            damageAssignments: [],
            firstStrikeDamageDealt: false,
          };
        });
    },
  });

  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await settleEngine();

  assert.equal(state.players.player2.hasLost, true);
  assert.deepEqual(state.turnOrder, ['player1', 'player3', 'player4']);
  assert.equal(state.zones.player2.BATTLEFIELD.length, 0);
  assert.equal(state.combat, null);
});

test('elimination during stack resolution removes that player controlled spells from the stack', async () => {
  const pendingSpell = makeLoseLifeSpell('Pending Spell', 'player1', 1);
  const finishingSpell = makeLoseLifeSpell('Finishing Spell', 'player2', 3);
  const stopperSpell = makeNoopSpell('Stack Stopper');
  const battlefieldPermanent = makeVanillaCreature('Stack Victim', 2, 2);

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Caster Commander'), cards: [finishingSpell, stopperSpell], playerName: 'Caster' },
      { commander: makeCommander('Stack Commander'), cards: [pendingSpell, battlefieldPermanent], playerName: 'Victim' },
      { commander: makeCommander('Support Commander A'), cards: [], playerName: 'Support A' },
      { commander: makeCommander('Support Commander B'), cards: [], playerName: 'Support B' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Finishing Spell' }, Zone.HAND)
        .moveCard({ playerId: 'player1', name: 'Stack Stopper' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Pending Spell' }, Zone.HAND)
        .moveCard({ playerId: 'player2', name: 'Stack Victim' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Stack Victim' }, { summoningSick: false })
        .setPlayer('player1', { manaPool: { C: 2 } })
        .setPlayer('player2', { life: 3 })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        })
        .mutateState((game) => {
          pushSpellOnStack(game, 'player2', 'Pending Spell');
        });
    },
  });

  engine.addMana('player1', 'C', 1);
  const finishingSpellId = state.zones.player1.HAND[0]?.objectId;
  assert.ok(finishingSpellId);

  await engine.submitAction({
    type: ActionType.CAST_SPELL,
    playerId: 'player1',
    cardId: finishingSpellId,
  });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player1' });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await settleEngine();

  assert.equal(state.players.player2.hasLost, true);
  assert.deepEqual(state.turnOrder, ['player1', 'player3', 'player4']);
  assert.equal(state.stack.length, 0);
  assert.equal(state.zones.player2.BATTLEFIELD.length, 0);
});

test('cleanup from one eliminated player can cascade through surviving player dies triggers', async () => {
  const doomedCreature = makeVanillaCreature('Doomed Creature', 2, 2);
  const stopperSpell = makeNoopSpell('Cascade Stopper');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Artist Commander'), cards: [BloodArtist], playerName: 'Artist' },
      { commander: makeCommander('Doomed Commander'), cards: [doomedCreature], playerName: 'Doomed' },
      { commander: makeCommander('Low Life Commander'), cards: [], playerName: 'Low Life' },
      { commander: makeCommander('Support Commander'), cards: [stopperSpell], playerName: 'Support' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Blood Artist' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Blood Artist' }, { summoningSick: false })
        .moveCard({ playerId: 'player4', name: 'Cascade Stopper' }, Zone.HAND)
        .setPlayer('player4', { manaPool: { C: 1 } })
        .moveCard({ playerId: 'player2', name: 'Doomed Creature' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player2', name: 'Doomed Creature' }, { summoningSick: false })
        .setPlayer('player2', { life: 0 })
        .setPlayer('player3', { life: 1 })
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
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await engine.submitAction({ type: ActionType.PASS_PRIORITY, playerId: 'player4' });
  await settleEngine();

  assert.equal(state.players.player2.hasLost, true);
  assert.equal(state.players.player3.hasLost, true);
  assert.deepEqual(state.turnOrder, ['player1', 'player4']);
  assert.ok(state.players.player1.life >= 41);
});

test('game ends when only one player remains after elimination cleanup', async () => {
  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('Winner Commander'), cards: [], playerName: 'Winner' },
      { commander: makeCommander('Loser A'), cards: [], playerName: 'Loser A' },
      { commander: makeCommander('Loser B'), cards: [], playerName: 'Loser B' },
      { commander: makeCommander('Loser C'), cards: [], playerName: 'Loser C' },
    ],
    setup: (builder) => {
      builder
        .setPlayer('player2', { life: 0 })
        .setPlayer('player3', { life: 0 })
        .setPlayer('player4', { life: 0 })
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

  assert.equal(state.isGameOver, true);
  assert.equal(state.winner, 'player1');
  assert.deepEqual(state.turnOrder, ['player1']);
  assert.equal(state.eventLog.some((event) => event.type === GameEventType.PLAYER_WON), true);
});
