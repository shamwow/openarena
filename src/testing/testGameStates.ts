import { Phase, Step, Zone } from '../engine/types';
import type { CardInstance, GameState, PlayerId } from '../engine/types';
import { createTestGameStateBuilder } from './testGameStateBuilder';

export interface TestGameStateDefinition {
  id: string;
  description?: string;
  build: () => GameState;
}

function getCommanderCard(state: GameState, playerId: PlayerId): CardInstance {
  const commander = state.zones[playerId].COMMAND[0];
  if (!commander) {
    throw new Error(`Missing commander in ${playerId}.COMMAND.`);
  }
  return commander;
}

function createPriorityResetDemoState(): GameState {
  return createTestGameStateBuilder()
    .moveCard({ playerId: 'player1', name: 'Command Tower' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Command Tower' }, { summoningSick: false })
    .moveCard({ playerId: 'player1', name: 'Reliquary Tower' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Reliquary Tower' }, { summoningSick: false })
    .moveCard({ playerId: 'player1', name: 'Sol Ring' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Sol Ring' }, { tapped: true, summoningSick: false })
    .moveCard({ playerId: 'player1', name: 'Arcane Signet' }, Zone.HAND)
    .moveCard({ playerId: 'player1', name: 'Wrath of God' }, Zone.EXILE)
    .moveCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Rhystic Study' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player3', name: 'Blood Artist' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player3', name: 'Blood Artist' }, { summoningSick: false })
    .moveCard({ playerId: 'player3', name: 'Grave Titan' }, Zone.GRAVEYARD)
    .moveCard({ playerId: 'player4', name: 'Swiftfoot Boots' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player4', name: 'Lightning Bolt' }, Zone.GRAVEYARD)
    .setPlayer('player1', { life: 32 })
    .setPlayer('player2', { life: 27 })
    .setPlayer('player3', { life: 18, poisonCounters: 1 })
    .setPlayer('player4', { life: 24 })
    .setTurn({
      turnNumber: 7,
      activePlayer: 'player1',
      currentPhase: Phase.PRECOMBAT_MAIN,
      currentStep: Step.MAIN,
      priorityPlayer: 'player1',
      passedPriority: [],
    })
    .build();
}

function createBigHandState(): GameState {
  return createTestGameStateBuilder()
    .mutateState((state) => {
      // Move all library cards to hand for player1
      const library = state.zones.player1.LIBRARY;
      const cards = library.splice(0);
      for (const card of cards) {
        card.zone = Zone.HAND;
        state.zones.player1.HAND.push(card);
      }
    })
    .setTurn({
      turnNumber: 10,
      activePlayer: 'player1',
      currentPhase: Phase.PRECOMBAT_MAIN,
      currentStep: Step.MAIN,
      priorityPlayer: 'player1',
      passedPriority: [],
    })
    .build();
}

function createCommanderLifecycleDemoState(): GameState {
  return createTestGameStateBuilder()
    .moveCard({ playerId: 'player2', name: 'Command Tower' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Command Tower' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Island', nth: 0 }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Island', nth: 0 }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Island', nth: 1 }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Island', nth: 1 }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Sol Ring' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Sol Ring' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Arcane Signet' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Arcane Signet' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Mind Stone' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Mind Stone' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Thought Vessel' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Thought Vessel' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Ponder' }, Zone.HAND)
    .mutateState((state) => {
      const commander = getCommanderCard(state, 'player2');
      state.players.player1.commanderDamageReceived[commander.objectId] = 14;
      state.players.player2.commanderTimesCast[commander.objectId] = 2;
      state.players.player1.life = 26;
      state.players.player2.life = 34;
      state.players.player3.life = 31;
      state.players.player4.life = 29;
    })
    .setTurn({
      turnNumber: 9,
      activePlayer: 'player2',
      currentPhase: Phase.PRECOMBAT_MAIN,
      currentStep: Step.MAIN,
      priorityPlayer: 'player2',
      passedPriority: [],
    })
    .build();
}

function createAttackTaxDemoState(): GameState {
  return createTestGameStateBuilder()
    .moveCard({ playerId: 'player1', name: 'Ghostly Prison' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player2', name: 'Propaganda' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player4', name: 'Krenko, Mob Boss' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player4', name: 'Krenko, Mob Boss' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Goblin Guide' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player4', name: 'Goblin Guide' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Shivan Dragon' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player4', name: 'Shivan Dragon' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Command Tower' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player4', name: 'Command Tower' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Sol Ring' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player4', name: 'Sol Ring' }, { summoningSick: false })
    .setPlayer('player1', { life: 34 })
    .setPlayer('player2', { life: 36 })
    .setPlayer('player3', { life: 28 })
    .setPlayer('player4', { life: 40 })
    .setTurn({
      turnNumber: 11,
      activePlayer: 'player4',
      currentPhase: Phase.COMBAT,
      currentStep: Step.DECLARE_ATTACKERS,
      priorityPlayer: 'player4',
      passedPriority: [],
    })
    .build();
}

function createTriggerHeavyDemoState(): GameState {
  return createTestGameStateBuilder()
    .moveCard({ playerId: 'player1', name: 'Rhystic Study' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player3', name: 'Blood Artist' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player3', name: 'Blood Artist' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Smothering Tithe' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Command Tower' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Command Tower' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Sol Ring' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Sol Ring' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Arcane Signet' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Arcane Signet' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Ponder' }, Zone.HAND)
    .moveCard({ playerId: 'player2', name: 'Brainstorm' }, Zone.HAND)
    .moveCard({ playerId: 'player2', name: 'Counterspell' }, Zone.HAND)
    .moveCard({ playerId: 'player3', name: 'Grave Titan' }, Zone.GRAVEYARD)
    .setPlayer('player1', { life: 34 })
    .setPlayer('player2', { life: 36 })
    .setPlayer('player3', { life: 18 })
    .setPlayer('player4', { life: 32 })
    .setTurn({
      turnNumber: 12,
      activePlayer: 'player2',
      currentPhase: Phase.PRECOMBAT_MAIN,
      currentStep: Step.MAIN,
      priorityPlayer: 'player2',
      passedPriority: [],
    })
    .build();
}

function createBattlefieldGroupingDemoState(): GameState {
  return createTestGameStateBuilder()
    .moveCard({ playerId: 'player1', name: 'Serra Angel', nth: 0 }, Zone.HAND)
    .moveCard({ playerId: 'player1', name: 'Swords to Plowshares' }, Zone.HAND)
    .moveCard({ playerId: 'player1', name: 'Heliod, Sun-Crowned' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Heliod, Sun-Crowned' }, { summoningSick: false })
    .moveCard({ playerId: 'player1', name: 'Solemn Simulacrum' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Solemn Simulacrum' }, { summoningSick: false })
    .moveCard({ playerId: 'player1', name: 'Ghostly Prison' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player1', name: 'Sol Ring' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player1', name: 'Command Tower' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player1', name: 'Plains', nth: 0 }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player2', name: 'Counterspell', nth: 0 }, Zone.HAND)
    .moveCard({ playerId: 'player2', name: 'Mulldrifter', nth: 0 }, Zone.HAND)
    .moveCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, { summoningSick: false })
    .moveCard({ playerId: 'player2', name: 'Rhystic Study' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player2', name: 'Sol Ring' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player2', name: 'Island', nth: 0 }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player3', name: 'Doom Blade', nth: 0 }, Zone.HAND)
    .moveCard({ playerId: 'player3', name: 'Sign in Blood', nth: 0 }, Zone.HAND)
    .moveCard({ playerId: 'player3', name: 'Ayara, First of Locthwain' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player3', name: 'Ayara, First of Locthwain' }, { summoningSick: false })
    .moveCard({ playerId: 'player3', name: 'Thought Vessel' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player3', name: 'Swamp', nth: 0 }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player4', name: 'Lightning Bolt', nth: 0 }, Zone.HAND)
    .moveCard({ playerId: 'player4', name: 'Shivan Dragon' }, Zone.HAND)
    .moveCard({ playerId: 'player4', name: 'Goblin Guide' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player4', name: 'Goblin Guide' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Lightning Greaves' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player4', name: 'Mountain', nth: 0 }, Zone.BATTLEFIELD)
    .setPlayer('player1', { life: 34 })
    .setPlayer('player2', { life: 27 })
    .setPlayer('player3', { life: 23 })
    .setPlayer('player4', { life: 19 })
    .setTurn({
      turnNumber: 5,
      activePlayer: 'player1',
      currentPhase: Phase.PRECOMBAT_MAIN,
      currentStep: Step.MAIN,
      priorityPlayer: 'player1',
      passedPriority: [],
    })
    .build();
}

export const testGameStateDefinitions: TestGameStateDefinition[] = [
  {
    id: 'priority-reset-demo',
    description: 'Precombat main state with distinctive permanents and a live pass/reset flow.',
    build: createPriorityResetDemoState,
  },
  {
    id: 'battlefield-grouping-demo',
    description: 'Battlefield state with mixed permanent types across seats for layout verification.',
    build: createBattlefieldGroupingDemoState,
  },
  {
    id: 'big-hand',
    description: 'Player 1 has ~100 cards in hand for testing hand rail overflow.',
    build: createBigHandState,
  },
  {
    id: 'commander-lifecycle-demo',
    description: 'Commander recast staging with command-zone tax, prior commander damage, and mana sources ready.',
    build: createCommanderLifecycleDemoState,
  },
  {
    id: 'attack-tax-demo',
    description: 'Combat state with Propaganda and Ghostly Prison taxing attacks into the table.',
    build: createAttackTaxDemoState,
  },
  {
    id: 'trigger-heavy-demo',
    description: 'Main-phase trigger board with Rhystic Study, Smothering Tithe, Blood Artist, and Talrand.',
    build: createTriggerHeavyDemoState,
  },
];

const testGameStateMap = new Map<string, TestGameStateDefinition>();

for (const definition of testGameStateDefinitions) {
  if (testGameStateMap.has(definition.id)) {
    throw new Error(`Duplicate test game state id "${definition.id}".`);
  }
  testGameStateMap.set(definition.id, definition);
}

export function getTestGameState(id: string): TestGameStateDefinition | undefined {
  return testGameStateMap.get(id);
}

export function hasTestGameState(id: string): boolean {
  return testGameStateMap.has(id);
}

export function listTestGameStateIds(): string[] {
  return [...testGameStateMap.keys()];
}
