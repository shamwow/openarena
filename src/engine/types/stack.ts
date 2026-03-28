import type { AbilityDefinition } from './abilities';
import type { CardInstance, LastKnownInformation } from './cards';
import type { ObjectId, PlayerId, Timestamp } from './core';
import type { EffectContext } from './effects';
import type { GameEvent } from './events';
import type { CardDefinition } from './spells';
import type { TargetSpec } from './targeting';

export const StackEntryType = {
  SPELL: 'SPELL',
  ACTIVATED_ABILITY: 'ACTIVATED_ABILITY',
  TRIGGERED_ABILITY: 'TRIGGERED_ABILITY',
} as const;
export type StackEntryType = (typeof StackEntryType)[keyof typeof StackEntryType];

export interface StackEntry {
  id: ObjectId;
  entryType: StackEntryType;
  sourceId: ObjectId;
  sourceCardId?: ObjectId;
  sourceZoneChangeCounter: number;
  sourceSnapshot?: LastKnownInformation;
  controller: PlayerId;
  timestamp: Timestamp;
  targets: (ObjectId | PlayerId)[];
  targetZoneChangeCounters?: Array<number | null>;
  targetSpecs?: TargetSpec[];
  targetGroupCounts?: number[];
  cardInstance?: CardInstance;
  ability?: AbilityDefinition;
  xValue?: number;
  spellDefinition?: CardDefinition;
  modeChoices?: number[];
  castMethod?: string;
  additionalCostsPaid?: string[];
  entersBattlefieldWithCounters?: Record<string, number>;
  triggeringEvent?: GameEvent;
  castAsAdventure?: boolean;
  chosenFace?: 'front' | 'back';
  chosenHalf?: 'left' | 'right' | 'fused';
  resolve: (ctx: EffectContext) => void | Promise<void>;
}
