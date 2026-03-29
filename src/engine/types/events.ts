import type { AttackTarget } from './combat';
import type { BattlefieldEntryState, PredefinedTokenType } from './effects';
import type { CardInstance, LastKnownInformation } from './cards';
import type { CardType, ObjectId, Phase, PlayerId, Step, Timestamp, Zone } from './core';
import type { ManaPool } from './mana';

export const GameEventType = {
  ZONE_CHANGE: 'ZONE_CHANGE',
  WOULD_ENTER_BATTLEFIELD: 'WOULD_ENTER_BATTLEFIELD',
  ENTERS_BATTLEFIELD: 'ENTERS_BATTLEFIELD',
  LEAVES_BATTLEFIELD: 'LEAVES_BATTLEFIELD',
  PHASE_CHANGE: 'PHASE_CHANGE',
  STEP_CHANGE: 'STEP_CHANGE',
  TURN_START: 'TURN_START',
  SPELL_CAST: 'SPELL_CAST',
  ABILITY_ACTIVATED: 'ABILITY_ACTIVATED',
  ABILITY_TRIGGERED: 'ABILITY_TRIGGERED',
  SPELL_RESOLVED: 'SPELL_RESOLVED',
  SPELL_COUNTERED: 'SPELL_COUNTERED',
  TAPPED: 'TAPPED',
  TAPPED_FOR_MANA: 'TAPPED_FOR_MANA',
  UNTAPPED: 'UNTAPPED',
  DESTROYED: 'DESTROYED',
  SACRIFICED: 'SACRIFICED',
  EXILED: 'EXILED',
  ATTACKS: 'ATTACKS',
  BLOCKS: 'BLOCKS',
  COMBAT_DAMAGE_DEALT: 'COMBAT_DAMAGE_DEALT',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  LIFE_GAINED: 'LIFE_GAINED',
  LIFE_LOST: 'LIFE_LOST',
  DREW_CARD: 'DREW_CARD',
  DISCARDED: 'DISCARDED',
  PLAYER_LOST: 'PLAYER_LOST',
  PLAYER_WON: 'PLAYER_WON',
  MANA_PRODUCED: 'MANA_PRODUCED',
  COUNTER_ADDED: 'COUNTER_ADDED',
  COUNTER_REMOVED: 'COUNTER_REMOVED',
  TOKEN_CREATED: 'TOKEN_CREATED',
  SEARCHED_LIBRARY: 'SEARCHED_LIBRARY',
  SCRY: 'SCRY',
  SURVEIL: 'SURVEIL',
  MILLED: 'MILLED',
} as const;
export type GameEventType = (typeof GameEventType)[keyof typeof GameEventType];

export interface BaseGameEvent {
  type: GameEventType;
  timestamp: Timestamp;
  sourceId?: ObjectId;
  sourceCardId?: ObjectId;
  sourceZoneChangeCounter?: number;
  cardId?: ObjectId;
  objectZoneChangeCounter?: number;
  newObjectZoneChangeCounter?: number;
  lastKnownInfo?: LastKnownInformation;
}

export interface ZoneChangeEvent extends BaseGameEvent {
  type: typeof GameEventType.ZONE_CHANGE;
  objectId: ObjectId;
  fromZone: Zone;
  toZone: Zone;
  controller: PlayerId;
}

export interface WouldEnterBattlefieldEvent extends BaseGameEvent {
  type: typeof GameEventType.WOULD_ENTER_BATTLEFIELD;
  objectId: ObjectId;
  controller: PlayerId;
  fromZone?: Zone;
  entering: CardInstance;
  entry: BattlefieldEntryState;
}

export interface EntersBattlefieldEvent extends BaseGameEvent {
  type: typeof GameEventType.ENTERS_BATTLEFIELD;
  objectId: ObjectId;
  controller: PlayerId;
}

export interface LeavesBattlefieldEvent extends BaseGameEvent {
  type: typeof GameEventType.LEAVES_BATTLEFIELD;
  objectId: ObjectId;
  controller: PlayerId;
  destination: Zone;
}

export interface SpellCastEvent extends BaseGameEvent {
  type: typeof GameEventType.SPELL_CAST;
  objectId: ObjectId;
  castBy: PlayerId;
  spellTypes: CardType[];
  castMethod?: string;
}

export interface DamageDealtEvent extends BaseGameEvent {
  type: typeof GameEventType.DAMAGE_DEALT;
  sourceId: ObjectId;
  targetId: ObjectId | PlayerId;
  amount: number;
  isCombatDamage: boolean;
  isCommanderDamage: boolean;
}

export interface LifeGainedEvent extends BaseGameEvent {
  type: typeof GameEventType.LIFE_GAINED;
  player: PlayerId;
  amount: number;
}

export interface LifeLostEvent extends BaseGameEvent {
  type: typeof GameEventType.LIFE_LOST;
  player: PlayerId;
  amount: number;
}

export interface DrewCardEvent extends BaseGameEvent {
  type: typeof GameEventType.DREW_CARD;
  player: PlayerId;
  objectId: ObjectId;
}

export interface DiscardedEvent extends BaseGameEvent {
  type: typeof GameEventType.DISCARDED;
  player: PlayerId;
  objectId: ObjectId;
}

export interface TappedEvent extends BaseGameEvent {
  type: typeof GameEventType.TAPPED;
  objectId: ObjectId;
}

export interface UntappedEvent extends BaseGameEvent {
  type: typeof GameEventType.UNTAPPED;
  objectId: ObjectId;
}

export interface TappedForManaEvent extends BaseGameEvent {
  type: typeof GameEventType.TAPPED_FOR_MANA;
  objectId: ObjectId;
  player: PlayerId;
}

export interface DestroyedEvent extends BaseGameEvent {
  type: typeof GameEventType.DESTROYED;
  objectId: ObjectId;
}

export interface SacrificedEvent extends BaseGameEvent {
  type: typeof GameEventType.SACRIFICED;
  objectId: ObjectId;
  controller: PlayerId;
}

export interface StepChangeEvent extends BaseGameEvent {
  type: typeof GameEventType.STEP_CHANGE;
  phase: Phase;
  step: Step;
  activePlayer: PlayerId;
}

export interface TurnStartEvent extends BaseGameEvent {
  type: typeof GameEventType.TURN_START;
  activePlayer: PlayerId;
  turnNumber: number;
}

export interface AttacksEvent extends BaseGameEvent {
  type: typeof GameEventType.ATTACKS;
  attackerId: ObjectId;
  defendingPlayer?: PlayerId;
  defender: AttackTarget;
}

export interface BlocksEvent extends BaseGameEvent {
  type: typeof GameEventType.BLOCKS;
  blockerId: ObjectId;
  attackerId: ObjectId;
}

export interface CounterAddedEvent extends BaseGameEvent {
  type: typeof GameEventType.COUNTER_ADDED;
  objectId: ObjectId;
  counterType: string;
  amount: number;
  player?: PlayerId;
}

export interface PlayerLostEvent extends BaseGameEvent {
  type: typeof GameEventType.PLAYER_LOST;
  player: PlayerId;
  reason: string;
}

export interface PlayerWonEvent extends BaseGameEvent {
  type: typeof GameEventType.PLAYER_WON;
  player: PlayerId;
}

export interface ManaProducedEvent extends BaseGameEvent {
  type: typeof GameEventType.MANA_PRODUCED;
  player: PlayerId;
  color: keyof ManaPool;
  amount: number;
}

export interface AbilityActivatedEvent extends BaseGameEvent {
  type: typeof GameEventType.ABILITY_ACTIVATED;
  sourceId: ObjectId;
}

export interface SpellResolvedEvent extends BaseGameEvent {
  type: typeof GameEventType.SPELL_RESOLVED;
  objectId: ObjectId;
}

export interface SpellCounteredEvent extends BaseGameEvent {
  type: typeof GameEventType.SPELL_COUNTERED;
  objectId: ObjectId;
}

export interface SearchedLibraryEvent extends BaseGameEvent {
  type: typeof GameEventType.SEARCHED_LIBRARY;
  player: PlayerId;
  foundIds: ObjectId[];
  destination: Zone;
}

export interface TokenCreatedEvent extends BaseGameEvent {
  type: typeof GameEventType.TOKEN_CREATED;
  player: PlayerId;
  objectId: ObjectId;
  tokenType?: PredefinedTokenType;
}

export interface ScryEvent extends BaseGameEvent {
  type: typeof GameEventType.SCRY;
  player: PlayerId;
  count: number;
}

export interface SurveilEvent extends BaseGameEvent {
  type: typeof GameEventType.SURVEIL;
  player: PlayerId;
  count: number;
}

export interface MilledEvent extends BaseGameEvent {
  type: typeof GameEventType.MILLED;
  player: PlayerId;
  objectIds: ObjectId[];
  count: number;
}

export type GameEvent =
  | ZoneChangeEvent
  | WouldEnterBattlefieldEvent
  | EntersBattlefieldEvent
  | LeavesBattlefieldEvent
  | SpellCastEvent
  | DamageDealtEvent
  | LifeGainedEvent
  | LifeLostEvent
  | DrewCardEvent
  | DiscardedEvent
  | TappedEvent
  | TappedForManaEvent
  | UntappedEvent
  | DestroyedEvent
  | SacrificedEvent
  | StepChangeEvent
  | TurnStartEvent
  | AttacksEvent
  | BlocksEvent
  | CounterAddedEvent
  | PlayerLostEvent
  | PlayerWonEvent
  | ManaProducedEvent
  | AbilityActivatedEvent
  | SpellResolvedEvent
  | SpellCounteredEvent
  | TokenCreatedEvent
  | SearchedLibraryEvent
  | ScryEvent
  | SurveilEvent
  | MilledEvent;
