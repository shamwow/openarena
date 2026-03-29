import type { AbilityDefinition } from './abilities';
import type { CardDefinition } from './spells';
import type { CardType, ObjectId, PlayerId, Timestamp, Zone } from './core';
import type { Cost } from './costs';

export interface AttackTaxRequirement {
  sourceId: ObjectId;
  defender: PlayerId;
  cost: Cost;
}

export interface CardInstance {
  cardId: ObjectId;
  objectId: ObjectId;
  zoneChangeCounter: number;
  definitionId: string;
  definition: CardDefinition;
  owner: PlayerId;
  controller: PlayerId;
  zone: Zone;
  timestamp: Timestamp;
  tapped: boolean;
  faceDown: boolean;
  summoningSick: boolean;
  counters: Record<string, number>;
  markedDamage: number;
  attachedTo: ObjectId | null;
  attachments: ObjectId[];
  copyOf?: ObjectId;
  isTransformed?: boolean;
  phasedOut?: boolean;
  castAsAdventure?: boolean;
  isToken?: boolean;
  exhaustedAbilityZoneChangeCounters?: Record<number, number>;
  exileInsteadOfDyingThisTurnZoneChangeCounter?: number;
  exileIfWouldLeaveBattlefieldZoneChangeCounter?: number;
  modifiedTypes?: CardType[];
  modifiedSubtypes?: string[];
  modifiedSupertypes?: string[];
  modifiedPower?: number;
  modifiedToughness?: number;
  modifiedAbilities?: AbilityDefinition[];
  attackTaxes?: AttackTaxRequirement[];
}

export type LastKnownInformation = CardInstance;
