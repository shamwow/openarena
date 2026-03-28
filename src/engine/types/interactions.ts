import type { CardInstance } from './cards';
import type { ObjectId, PlayerId } from './core';
import type { Cost } from './costs';
import type { CardFilter } from './filters';
import type { ProtectionFrom } from './spells';
import type { GameState } from './state';
import type { TargetSpec } from './targeting';

export type InteractionKind = 'target' | 'damage' | 'attach' | 'block';
export type InteractionPhase = 'candidate' | 'lock' | 'revalidate';

export interface InteractionSourceMatcher {
  controller?: 'same' | 'opponents' | 'anyone';
  qualities?: ProtectionFrom;
}

export type InteractionHookDef =
  | {
      type: 'forbid';
      interactions: InteractionKind[];
      phases?: InteractionPhase[];
      filter: CardFilter;
      source?: InteractionSourceMatcher;
      reason?: string;
    }
  | {
      type: 'require-cost';
      interaction: 'target';
      phase?: InteractionPhase;
      filter: CardFilter;
      source?: InteractionSourceMatcher;
      cost: Cost;
      prompt?: string;
      onFailure: 'deny-action' | 'counter-source';
      requirementScope?: 'object-instance' | 'source-and-object-instance';
    };

export interface InteractionRequirement {
  id: string;
  prompt: string;
  cost: Cost;
  onFailure: 'deny-action' | 'counter-source';
}

export type InteractionVerdict =
  | { kind: 'allow' }
  | { kind: 'forbid'; reason?: string }
  | { kind: 'require'; requirement: InteractionRequirement };

export interface InteractionContext {
  state: GameState;
  actor: CardInstance;
  actorController: PlayerId;
  object: CardInstance;
  kind: InteractionKind;
  phase: InteractionPhase;
  spec?: TargetSpec;
  isCombatDamage?: boolean;
}

export interface CompiledInteractionHook {
  id: string;
  sourceId: ObjectId;
  appliesTo: (object: CardInstance, game: GameState) => boolean;
  evaluate: (ctx: InteractionContext) => InteractionVerdict | InteractionVerdict[] | null;
}
