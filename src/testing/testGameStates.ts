import { Phase, Step, Zone } from '../engine/types';
import type { GameState } from '../engine/types';
import { createTestGameStateBuilder } from './testGameStateBuilder';

export interface TestGameStateDefinition {
  id: string;
  description?: string;
  build: () => GameState;
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

function createHiddenHandHoverDemoState(): GameState {
  return createTestGameStateBuilder()
    .moveCard({ playerId: 'player2', name: 'Talrand, Sky Summoner' }, Zone.COMMAND)
    .moveCard({ playerId: 'player2', name: 'Counterspell' }, Zone.HAND, { position: 'start' })
    .moveCard({ playerId: 'player2', name: 'Brainstorm' }, Zone.HAND, { position: 1 })
    .moveCard({ playerId: 'player2', name: 'Ponder' }, Zone.HAND, { position: 2 })
    .moveCard({ playerId: 'player2', name: 'Rhystic Study' }, Zone.BATTLEFIELD)
    .moveCard({ playerId: 'player1', name: 'Arcane Signet' }, Zone.HAND)
    .moveCard({ playerId: 'player1', name: 'Command Tower' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player1', name: 'Command Tower' }, { summoningSick: false })
    .moveCard({ playerId: 'player3', name: 'Blood Artist' }, Zone.BATTLEFIELD)
    .setBattlefieldCard({ playerId: 'player3', name: 'Blood Artist' }, { summoningSick: false })
    .moveCard({ playerId: 'player4', name: 'Swiftfoot Boots' }, Zone.BATTLEFIELD)
    .setPlayer('player1', { life: 34 })
    .setPlayer('player2', { life: 29 })
    .setPlayer('player3', { life: 21 })
    .setPlayer('player4', { life: 25 })
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
    id: 'hidden-hand-hover-demo',
    description:
      'Idle main-phase board with player2 showing Talrand in command plus three concealed hand cards (Counterspell, Brainstorm, Ponder) for hover/preview verification.',
    build: createHiddenHandHoverDemoState,
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
