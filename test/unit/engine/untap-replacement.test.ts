import assert from 'node:assert/strict';
import test from 'node:test';

import { CardBuilder } from '../../../src/cards/CardBuilder.ts';
import { WateryGrasp } from '../../../src/cards/sets/TLA/watery-grasp.ts';
import { IntruderAlarm } from '../../../src/cards/sets/TLE/intruder-alarm.ts';
import { TyLeeChiBlocker } from '../../../src/cards/sets/TLA/ty-lee-chi-blocker.ts';
import { CardType, GameEventType, Phase, Step, Zone } from '../../../src/engine/types.ts';
import type { GameState } from '../../../src/engine/types.ts';
import { createHarness, getCard, makeCommander } from './helpers.ts';

function makeCreature(name: string, cost = '{1}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.CREATURE)
    .stats(2, 2)
    .build();
}

function makeArtifact(name: string, cost = '{1}') {
  return CardBuilder.create(name)
    .cost(cost)
    .types(CardType.ARTIFACT)
    .build();
}

function makeDoesntUntapEnchantment() {
  return CardBuilder.create('Freeze Aura')
    .cost('{U}')
    .types(CardType.ENCHANTMENT)
    .staticAbility(
      {
        type: 'replacement',
        replaces: GameEventType.UNTAPPED,
        condition: (_game, _source, event) =>
          'isUntapStep' in event && event.isUntapStep === true,
        replace: () => null,
      },
      { description: "Permanents don't untap during their controllers' untap steps." },
    )
    .build();
}

function advanceToUntapStep(engine: unknown, state: GameState, playerId: 'player1') {
  const internal = engine as {
    turnManager: {
      advanceStep: (game: GameState) => void;
      startTurn: (game: GameState, playerId: string) => void;
    };
    continuousEffects: {
      applyAll: (game: GameState) => void;
    };
  };
  internal.continuousEffects.applyAll(state);
  internal.turnManager.startTurn(state, playerId);
}

test('replacement effect prevents permanents from untapping during untap step', () => {
  const creature = makeCreature('Frozen Soldier');
  const freezeAura = makeDoesntUntapEnchantment();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{U}'), cards: [creature, freezeAura], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Frozen Soldier' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Freeze Aura' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Frozen Soldier' }, { tapped: true, summoningSick: false })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.ENDING,
          currentStep: Step.CLEANUP,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  const soldier = getCard(state, 'player1', Zone.BATTLEFIELD, 'Frozen Soldier');
  assert.equal(soldier.tapped, true, 'Soldier should start tapped');

  advanceToUntapStep(engine, state, 'player1');

  assert.equal(soldier.tapped, true, 'Soldier should remain tapped after untap step due to replacement effect');
});

test('replacement effect only prevents untap-step untaps, not card-effect untaps', () => {
  const creature = makeCreature('Frozen Soldier');
  const freezeAura = makeDoesntUntapEnchantment();

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{U}'), cards: [creature, freezeAura], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Frozen Soldier' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Freeze Aura' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Frozen Soldier' }, { tapped: true, summoningSick: false })
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const soldier = getCard(state, 'player1', Zone.BATTLEFIELD, 'Frozen Soldier');
  assert.equal(soldier.tapped, true);

  // Card-effect untap should still work (not an untap step)
  engine.untapPermanent(soldier.objectId);
  assert.equal(soldier.tapped, false, 'Card-effect untap should bypass the replacement');
});

test('Intruder Alarm prevents only creature untaps during untap step', () => {
  const creature = makeCreature('Tapped Warrior');
  const artifact = makeArtifact('Tapped Artifact');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{U}'), cards: [creature, artifact, IntruderAlarm], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Tapped Warrior' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Tapped Artifact' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Intruder Alarm' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Tapped Warrior' }, { tapped: true, summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Tapped Artifact' }, { tapped: true })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.ENDING,
          currentStep: Step.CLEANUP,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  const warrior = getCard(state, 'player1', Zone.BATTLEFIELD, 'Tapped Warrior');
  const artifact2 = getCard(state, 'player1', Zone.BATTLEFIELD, 'Tapped Artifact');
  assert.equal(warrior.tapped, true);
  assert.equal(artifact2.tapped, true);

  advanceToUntapStep(engine, state, 'player1');

  assert.equal(warrior.tapped, true, 'Creature should remain tapped due to Intruder Alarm');
  assert.equal(artifact2.tapped, false, 'Artifact should untap normally');
});

test('Watery Grasp prevents only enchanted creature from untapping', () => {
  const target = makeCreature('Grasped Target');
  const other = makeCreature('Free Creature');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{U}'), cards: [target, other, WateryGrasp], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Grasped Target' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Free Creature' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Watery Grasp' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Grasped Target' }, { tapped: true, summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Free Creature' }, { tapped: true, summoningSick: false })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.ENDING,
          currentStep: Step.CLEANUP,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  // Attach Watery Grasp to the target
  const graspCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Watery Grasp');
  const targetCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Grasped Target');
  const freeCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Free Creature');
  engine.attachPermanent(graspCard.objectId, targetCard.objectId);

  advanceToUntapStep(engine, state, 'player1');

  assert.equal(targetCard.tapped, true, 'Enchanted creature should remain tapped');
  assert.equal(freeCard.tapped, false, 'Non-enchanted creature should untap normally');
});

test('Ty Lee Chi Blocker locks target creature from untapping', async () => {
  const target = makeCreature('Locked Target');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{U}'), cards: [TyLeeChiBlocker, target], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    choiceResponder: (request) => {
      // Choose the target creature for Ty Lee's ETB
      if (request.type === 'chooseUpToN') {
        request.resolve(request.options.slice(0, 1));
        return;
      }
      if (request.type === 'chooseYesNo') { request.resolve(true); return; }
      if (request.type === 'chooseOne' || request.type === 'choosePlayer') { request.resolve(request.options[0]); return; }
      if (request.type === 'chooseN' || request.type === 'chooseUpToN') { request.resolve(request.options.slice(0, request.count ?? 0)); return; }
      if (request.type === 'orderObjects') { request.resolve(request.options); return; }
      request.resolve(request.options);
    },
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Locked Target' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Ty Lee, Chi Blocker' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Locked Target' }, { summoningSick: false })
        .setBattlefieldCard({ playerId: 'player1', name: 'Ty Lee, Chi Blocker' }, { summoningSick: false })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.ENDING,
          currentStep: Step.CLEANUP,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  // Ty Lee's ETB should have tapped the target and added a lock counter
  const targetCard = getCard(state, 'player1', Zone.BATTLEFIELD, 'Locked Target');
  const tyLee = getCard(state, 'player1', Zone.BATTLEFIELD, 'Ty Lee, Chi Blocker');

  // Manually tap and add lock counter (ETB doesn't fire in setup)
  engine.tapPermanent(targetCard.objectId);
  engine.addCounters(targetCard.objectId, `locked-by-ty-lee:${tyLee.objectId}`, 1);

  advanceToUntapStep(engine, state, 'player1');

  assert.equal(targetCard.tapped, true, 'Locked target should remain tapped');
  assert.equal(tyLee.tapped, false, 'Ty Lee herself should untap normally');
});

test('untap step emits UNTAPPED events for permanents that do untap', () => {
  const creature = makeCreature('Normal Soldier');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{W}'), cards: [creature], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Normal Soldier' }, Zone.BATTLEFIELD)
        .setBattlefieldCard({ playerId: 'player1', name: 'Normal Soldier' }, { tapped: true, summoningSick: false })
        .setTurn({
          activePlayer: 'player4',
          currentPhase: Phase.ENDING,
          currentStep: Step.CLEANUP,
          priorityPlayer: null,
          passedPriority: [],
        });
    },
  });

  const soldier = getCard(state, 'player1', Zone.BATTLEFIELD, 'Normal Soldier');
  const eventCountBefore = state.eventLog.filter(e => e.type === GameEventType.UNTAPPED).length;

  advanceToUntapStep(engine, state, 'player1');

  assert.equal(soldier.tapped, false, 'Soldier should untap normally');

  const untapEvents = state.eventLog.filter(
    e => e.type === GameEventType.UNTAPPED && 'isUntapStep' in e && e.isUntapStep,
  );
  assert.ok(untapEvents.length > eventCountBefore, 'Should emit UNTAPPED events during untap step');
});

test('backward compat: deal-damage replacement effects still work', () => {
  const damageDoubler = CardBuilder.create('Damage Doubler')
    .cost('{R}')
    .types(CardType.ENCHANTMENT)
    .staticAbility(
      {
        type: 'replacement',
        replaces: 'deal-damage',
        replace: (game, source, event) => {
          if (event.type !== GameEventType.DAMAGE_DEALT) return event;
          return { ...event, amount: (event as any).amount * 2 };
        },
      },
      { description: 'Double all damage.' },
    )
    .build();

  const target = makeCreature('Punching Bag');

  const { state, engine } = createHarness({
    decks: [
      { commander: makeCommander('P1 Commander', '{R}'), cards: [damageDoubler, target], playerName: 'P1' },
      { commander: makeCommander('P2 Commander', '{2}'), cards: [], playerName: 'P2' },
      { commander: makeCommander('P3 Commander', '{2}'), cards: [], playerName: 'P3' },
      { commander: makeCommander('P4 Commander', '{2}'), cards: [], playerName: 'P4' },
    ],
    setup: (builder) => {
      builder
        .moveCard({ playerId: 'player1', name: 'Damage Doubler' }, Zone.BATTLEFIELD)
        .moveCard({ playerId: 'player1', name: 'Punching Bag' }, Zone.BATTLEFIELD)
        .setTurn({
          activePlayer: 'player1',
          currentPhase: Phase.PRECOMBAT_MAIN,
          currentStep: Step.MAIN,
          priorityPlayer: 'player1',
          passedPriority: [],
        });
    },
  });

  const bag = getCard(state, 'player1', Zone.BATTLEFIELD, 'Punching Bag');
  const commanderId = getCard(state, 'player1', Zone.COMMAND, 'P1 Commander').objectId;

  engine.dealDamage(commanderId, bag.objectId, 1, false);

  assert.equal(bag.markedDamage, 2, 'Damage should be doubled by replacement effect');
});
