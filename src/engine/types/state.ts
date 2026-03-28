import type { TriggeredAbilityDef } from './abilities';
import type { CardInstance, LastKnownInformation } from './cards';
import type { CombatState, PendingCombatPhase } from './combat';
import type { Phase, PlayerId, Step, Zone, ObjectId, ManaColor } from './core';
import type {
  ContinuousEffect,
  ReplacementEffect,
  WouldEnterBattlefieldReplacementEffect,
} from './effects';
import type { GameEvent } from './events';
import type { CardFilter } from './filters';
import type { CompiledInteractionHook } from './interactions';
import type { Cost } from './costs';
import type { ManaPool, TrackedMana } from './mana';
import type { StackEntry } from './stack';

export interface PlayerState {
  id: PlayerId;
  name: string;
  life: number;
  manaPool: ManaPool;
  commanderDamageReceived: Record<ObjectId, number>;
  commanderTimesCast: Record<ObjectId, number>;
  hasPlayedLand: boolean;
  landsPlayedThisTurn: number;
  landPlaysAvailable: number;
  hasLost: boolean;
  hasConceded: boolean;
  poisonCounters: number;
  commanderIds: ObjectId[];
  colorIdentity: ManaColor[];
  drewFromEmptyLibrary: boolean;
  trackedMana: TrackedMana[];
  spellsCastThisTurn?: number;
  experienceCounters?: number;
  energyCounters?: number;
}

export interface DelayedTrigger {
  id: ObjectId;
  ability: TriggeredAbilityDef;
  source: CardInstance;
  controller: PlayerId;
  expiresAfterTrigger: boolean;
}

export interface CastPermission {
  objectId: ObjectId;
  zoneChangeCounter: number;
  zone: Zone;
  castBy: PlayerId;
  owner: PlayerId;
  alternativeCost: Cost;
  reason: string;
  timing: 'normal';
  castOnly: true;
}

export interface PendingTrigger {
  ability: TriggeredAbilityDef;
  source: CardInstance;
  event: GameEvent;
  controller: PlayerId;
  delayedTriggerId?: ObjectId;
}

export interface GameState {
  turnNumber: number;
  activePlayer: PlayerId;
  currentPhase: Phase;
  currentStep: Step;
  players: Record<PlayerId, PlayerState>;
  turnOrder: PlayerId[];
  zones: Record<PlayerId, Record<Zone, CardInstance[]>>;
  stack: StackEntry[];
  combat: CombatState | null;
  continuousEffects: ContinuousEffect[];
  replacementEffects: ReplacementEffect[];
  wouldEnterBattlefieldReplacementEffects: WouldEnterBattlefieldReplacementEffect[];
  interactionHooks: CompiledInteractionHook[];
  exileInsteadOfDyingThisTurn: Set<string>;
  lastKnownInformation: Record<string, LastKnownInformation>;
  timestampCounter: number;
  objectIdCounter: number;
  eventLog: GameEvent[];
  priorityPlayer: PlayerId | null;
  passedPriority: Set<PlayerId>;
  pendingTriggers: PendingTrigger[];
  delayedTriggers: DelayedTrigger[];
  castPermissions: CastPermission[];
  waitingForChoice: boolean;
  isGameOver: boolean;
  winner: PlayerId | null;
  loyaltyAbilitiesUsedThisTurn?: string[];
  triggeredAbilitiesUsedThisTurn?: Set<string>;
  dayNight?: 'day' | 'night';
  monarch?: PlayerId;
  initiativeHolder?: PlayerId;
  spellsCastLastTurn?: Record<PlayerId, number>;
  lastCompletedTurnPlayer?: PlayerId;
  pendingFreeCasts?: Array<{ objectId: ObjectId; playerId: PlayerId; reason: 'suspend' }>;
  pendingExtraTurns?: PlayerId[];
  pendingExtraCombatPhases?: PendingCombatPhase[];
  currentCombatAttackRestriction?: CardFilter | null;
  mulliganState?: {
    activePlayer: PlayerId;
    taken: Partial<Record<PlayerId, number>>;
    kept: Partial<Record<PlayerId, boolean>>;
  };
}
