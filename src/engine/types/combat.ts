import type { ObjectId, PlayerId } from './core';
import type { CardFilter } from './filters';

export interface AttackTarget {
  type: 'player' | 'planeswalker';
  id: ObjectId | PlayerId;
}

export interface PendingCombatPhase {
  attackRestriction?: CardFilter;
}

export interface CombatState {
  attackingPlayer: PlayerId;
  attackers: Map<ObjectId, AttackTarget>;
  blockers: Map<ObjectId, ObjectId>;
  blockerOrder: Map<ObjectId, ObjectId[]>;
  damageAssignments: DamageAssignment[];
  firstStrikeDamageDealt: boolean;
}

export interface DamageAssignment {
  sourceId: ObjectId;
  targetId: ObjectId | PlayerId;
  amount: number;
}
