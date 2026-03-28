import type { AttackTarget } from './combat';
import type { ObjectId, PlayerId } from './core';

export const ActionType = {
  CAST_SPELL: 'CAST_SPELL',
  ACTIVATE_ABILITY: 'ACTIVATE_ABILITY',
  PLAY_LAND: 'PLAY_LAND',
  DECLARE_ATTACKERS: 'DECLARE_ATTACKERS',
  DECLARE_BLOCKERS: 'DECLARE_BLOCKERS',
  PASS_PRIORITY: 'PASS_PRIORITY',
  CONCEDE: 'CONCEDE',
  PAY_MANA: 'PAY_MANA',
  CHOOSE_TARGETS: 'CHOOSE_TARGETS',
  MULLIGAN_KEEP: 'MULLIGAN_KEEP',
  MULLIGAN_TAKE: 'MULLIGAN_TAKE',
  COMMANDER_TO_COMMAND_ZONE: 'COMMANDER_TO_COMMAND_ZONE',
} as const;
export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export interface CastSpellAction {
  type: typeof ActionType.CAST_SPELL;
  playerId: PlayerId;
  cardId: ObjectId;
  targets?: (ObjectId | PlayerId)[];
  modeChoices?: number[];
  xValue?: number;
  chosenFace?: 'front' | 'back';
  chosenHalf?: 'left' | 'right' | 'fused';
  castMethod?: string;
  castAsAdventure?: boolean;
}

export interface ActivateAbilityAction {
  type: typeof ActionType.ACTIVATE_ABILITY;
  playerId: PlayerId;
  sourceId: ObjectId;
  abilityIndex: number;
  targets?: (ObjectId | PlayerId)[];
}

export interface PlayLandAction {
  type: typeof ActionType.PLAY_LAND;
  playerId: PlayerId;
  cardId: ObjectId;
  chosenFace?: 'front' | 'back';
}

export interface DeclareAttackersAction {
  type: typeof ActionType.DECLARE_ATTACKERS;
  playerId: PlayerId;
  attackers: Array<{
    attackerId: ObjectId;
    defendingPlayer?: PlayerId;
    defender?: AttackTarget;
  }>;
}

export interface DeclareBlockersAction {
  type: typeof ActionType.DECLARE_BLOCKERS;
  playerId: PlayerId;
  blockers: Array<{ blockerId: ObjectId; attackerId: ObjectId }>;
}

export interface PassPriorityAction {
  type: typeof ActionType.PASS_PRIORITY;
  playerId: PlayerId;
}

export interface MulliganKeepAction {
  type: typeof ActionType.MULLIGAN_KEEP;
  playerId: PlayerId;
}

export interface MulliganTakeAction {
  type: typeof ActionType.MULLIGAN_TAKE;
  playerId: PlayerId;
}

export interface ConcedeAction {
  type: typeof ActionType.CONCEDE;
  playerId: PlayerId;
}

export interface CommanderToCommandZoneAction {
  type: typeof ActionType.COMMANDER_TO_COMMAND_ZONE;
  playerId: PlayerId;
  cardId: ObjectId;
}

export type PlayerAction =
  | CastSpellAction
  | ActivateAbilityAction
  | PlayLandAction
  | DeclareAttackersAction
  | DeclareBlockersAction
  | PassPriorityAction
  | MulliganKeepAction
  | MulliganTakeAction
  | ConcedeAction
  | CommanderToCommandZoneAction;
