import type { AbilityDefinition } from './abilities';
import type { CardInstance } from './cards';
import type { PendingCombatPhase } from './combat';
import type { ObjectId, PlayerId, Zone } from './core';
import type { Cost } from './costs';
import type { AddCounterOptions, AddManaOptions, ManaCost, ManaPool } from './mana';
import type { CardDefinition } from './spells';
import type { DelayedTrigger, GameState } from './state';
import type { CardFilter } from './filters';
import type { EffectDuration, PredefinedTokenType, SearchLibraryOptions } from './effects';
import type { GameEvent } from './events';

export interface GameEngine {
  getState(): GameState;
  drawCards(player: PlayerId, count: number): void;
  addMana(player: PlayerId, color: keyof ManaPool, amount: number, options?: AddManaOptions): void;
  payMana(player: PlayerId, cost: ManaCost): boolean;
  canPayMana(player: PlayerId, cost: ManaCost): boolean;
  gainLife(player: PlayerId, amount: number): void;
  loseLife(player: PlayerId, amount: number): void;
  dealDamage(sourceId: ObjectId, targetId: ObjectId | PlayerId, amount: number, isCombat: boolean): void;
  destroyPermanent(objectId: ObjectId): void;
  sacrificePermanent(objectId: ObjectId, controller: PlayerId): void;
  exilePermanent(objectId: ObjectId): void;
  moveCard(objectId: ObjectId, toZone: Zone, toOwner?: PlayerId): void;
  createToken(controller: PlayerId, definition: Partial<CardDefinition>): CardInstance;
  createPredefinedToken(controller: PlayerId, tokenType: PredefinedTokenType): CardInstance;
  addCounters(objectId: ObjectId, counterType: string, amount: number, options?: AddCounterOptions): void;
  removeCounters(objectId: ObjectId, counterType: string, amount: number): void;
  tapPermanent(objectId: ObjectId): void;
  untapPermanent(objectId: ObjectId): void;
  counterSpell(stackEntryId: ObjectId): void;
  findCards(zone: Zone, filter?: CardFilter, controller?: PlayerId): CardInstance[];
  getCard(objectId: ObjectId): CardInstance | undefined;
  getBattlefield(filter?: CardFilter, controller?: PlayerId): CardInstance[];
  getHand(player: PlayerId): CardInstance[];
  getGraveyard(player: PlayerId): CardInstance[];
  getLibrary(player: PlayerId): CardInstance[];
  discardCard(player: PlayerId, objectId: ObjectId): void;
  shuffleLibrary(player: PlayerId): void;
  emitEvent(event: GameEvent): void;
  getOpponents(player: PlayerId): PlayerId[];
  getActivePlayers(): PlayerId[];
  searchLibrary(player: PlayerId, filter: CardFilter, destination: Zone, count: number): Promise<CardInstance[]>;
  searchLibraryWithOptions(options: SearchLibraryOptions): Promise<CardInstance[]>;
  scry(player: PlayerId, count: number): Promise<void>;
  mill(player: PlayerId, count: number): void;
  fight(creatureAId: ObjectId, creatureBId: ObjectId): void;
  returnToHand(objectId: ObjectId): void;
  attachPermanent(attachmentId: ObjectId, hostId: ObjectId): void;
  detachPermanent(attachmentId: ObjectId): void;
  proliferate(player: PlayerId): Promise<void>;
  copyPermanent(objectId: ObjectId, controller: PlayerId): CardInstance | undefined;
  copySpellOnStack(stackEntryId: ObjectId, newController: PlayerId): void;
  changeControl(objectId: ObjectId, newController: PlayerId, duration?: EffectDuration): void;
  castWithoutPayingManaCost(cardId: ObjectId, controller: PlayerId): Promise<void>;
  createEmblem(controller: PlayerId, abilities: AbilityDefinition[], description: string): CardInstance;
  transformPermanent(objectId: ObjectId): void;
  becomeMonarch(player: PlayerId): void;
  becomeInitiativeHolder(player: PlayerId): void;
  registerDelayedTrigger(trigger: DelayedTrigger): void;
  airbendObject(objectId: ObjectId, cost: Cost, actingPlayer: PlayerId): void;
  earthbendLand(targetId: ObjectId, counterCount: number, returnController: PlayerId): void;
  grantPumpToObjectsUntilEndOfTurn(objectIds: ObjectId[], power: number, toughness: number): void;
  grantAbilitiesUntilEndOfTurn(
    sourceId: ObjectId,
    objectId: ObjectId,
    zoneChangeCounter: number,
    abilities: AbilityDefinition[],
  ): void;
  unlessPlayerPays(player: PlayerId, sourceId: ObjectId, cost: Cost, prompt: string): Promise<boolean>;
  sacrificePermanents(player: PlayerId, filter: CardFilter, count: number, prompt?: string): Promise<CardInstance[]>;
  addPlayerCounters(player: PlayerId, counterType: 'experience' | 'energy', amount: number): void;
  removePlayerCounters(player: PlayerId, counterType: 'experience' | 'energy', amount: number): boolean;
  grantExtraTurn(player: PlayerId): void;
  grantExtraCombat(options?: PendingCombatPhase): void;
  endTurn(): void;
}
