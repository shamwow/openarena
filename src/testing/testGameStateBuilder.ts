import { prebuiltDecks } from '../cards/decks';
import { createBaseGameState, type DeckConfig } from '../engine/GameState';
import type {
  CardInstance,
  GameState,
  ManaPool,
  Phase,
  PlayerId,
  PlayerState,
  Step,
  Zone,
} from '../engine/types';
import { Zone as ZoneType } from '../engine/types';

export interface CardSelector {
  playerId: PlayerId;
  name: string;
  nth?: number;
}

export interface MoveCardOptions {
  playerId?: PlayerId;
  position?: number | 'start' | 'end' | 'top' | 'bottom';
}

export interface BattlefieldCardState {
  tapped?: boolean;
  summoningSick?: boolean;
  counters?: Record<string, number>;
  markedDamage?: number;
  controller?: PlayerId;
}

export interface PlayerStatePatch {
  life?: PlayerState['life'];
  poisonCounters?: PlayerState['poisonCounters'];
  hasPlayedLand?: PlayerState['hasPlayedLand'];
  landsPlayedThisTurn?: PlayerState['landsPlayedThisTurn'];
  landPlaysAvailable?: PlayerState['landPlaysAvailable'];
  manaPool?: Partial<ManaPool>;
  hasLost?: PlayerState['hasLost'];
}

export interface TurnStatePatch {
  turnNumber?: GameState['turnNumber'];
  activePlayer?: GameState['activePlayer'];
  currentPhase?: Phase;
  currentStep?: Step;
  priorityPlayer?: GameState['priorityPlayer'];
  passedPriority?: Iterable<PlayerId>;
}

const NON_BATTLEFIELD_ZONES: Zone[] = [
  ZoneType.HAND,
  ZoneType.GRAVEYARD,
  ZoneType.EXILE,
  ZoneType.COMMAND,
  ZoneType.LIBRARY,
];

const ALL_ZONE_ORDER: Zone[] = [
  ZoneType.LIBRARY,
  ZoneType.HAND,
  ZoneType.BATTLEFIELD,
  ZoneType.GRAVEYARD,
  ZoneType.EXILE,
  ZoneType.COMMAND,
  ZoneType.STACK,
];

export class TestGameStateBuilder {
  private readonly state: GameState;
  private readonly commanderIdsByOwner: Record<PlayerId, Set<string>>;
  private readonly cardsByOwnerAndName: Record<PlayerId, Map<string, CardInstance[]>>;

  constructor(decks: DeckConfig[] = prebuiltDecks) {
    this.state = createBaseGameState(decks);
    this.commanderIdsByOwner = {} as Record<PlayerId, Set<string>>;
    this.cardsByOwnerAndName = {} as Record<PlayerId, Map<string, CardInstance[]>>;

    for (const playerId of this.state.turnOrder) {
      this.commanderIdsByOwner[playerId] = new Set(this.state.players[playerId].commanderIds);
      this.cardsByOwnerAndName[playerId] = new Map();
    }

    for (const playerId of this.state.turnOrder) {
      for (const zone of ALL_ZONE_ORDER) {
        for (const card of this.state.zones[playerId][zone]) {
          const byName = this.cardsByOwnerAndName[playerId];
          const cards = byName.get(card.definition.name) ?? [];
          cards.push(card);
          byName.set(card.definition.name, cards);
        }
      }
    }
  }

  moveCard(selector: CardSelector, zone: Zone, options: MoveCardOptions = {}): this {
    if (zone === ZoneType.STACK) {
      throw new Error('Use mutateState() for stack setup; STACK is not supported by moveCard().');
    }

    const card = this.resolveCard(selector);
    const targetPlayer = options.playerId ?? card.owner;

    if (zone !== ZoneType.BATTLEFIELD && targetPlayer !== card.owner) {
      throw new Error(`Cannot move ${this.describeCard(card)} to ${zone} for ${targetPlayer}; non-battlefield zones must use the card owner.`);
    }

    if (zone === ZoneType.COMMAND && !this.commanderIdsByOwner[card.owner].has(card.objectId)) {
      throw new Error(`Cannot place non-commander ${this.describeCard(card)} into COMMAND.`);
    }

    this.removeCardFromAllZones(card.objectId);

    card.zone = zone;
    card.timestamp = this.state.timestampCounter++;

    if (zone === ZoneType.BATTLEFIELD) {
      card.controller = targetPlayer;
      this.insertIntoZone(this.state.zones[targetPlayer].BATTLEFIELD, card, options.position);
    } else {
      this.resetNonBattlefieldCardState(card);
      card.controller = card.owner;
      this.insertIntoZone(this.state.zones[card.owner][zone], card, options.position);
    }

    return this;
  }

  setBattlefieldCard(selector: CardSelector, patch: BattlefieldCardState): this {
    const card = this.resolveCard(selector);
    if (card.zone !== ZoneType.BATTLEFIELD) {
      throw new Error(`Cannot set battlefield state for ${this.describeCard(card)} because it is in ${card.zone}.`);
    }

    if (patch.controller && patch.controller !== card.controller) {
      const currentZone = this.state.zones[card.controller].BATTLEFIELD;
      const currentIndex = currentZone.findIndex(zoneCard => zoneCard.objectId === card.objectId);
      if (currentIndex < 0) {
        throw new Error(`Could not locate ${this.describeCard(card)} in ${card.controller}'s battlefield.`);
      }
      currentZone.splice(currentIndex, 1);
      card.controller = patch.controller;
      this.state.zones[patch.controller].BATTLEFIELD.push(card);
    }

    if (patch.tapped !== undefined) card.tapped = patch.tapped;
    if (patch.summoningSick !== undefined) card.summoningSick = patch.summoningSick;
    if (patch.counters !== undefined) card.counters = { ...patch.counters };
    if (patch.markedDamage !== undefined) card.markedDamage = patch.markedDamage;

    return this;
  }

  setPlayer(playerId: PlayerId, patch: PlayerStatePatch): this {
    const player = this.state.players[playerId];

    if (patch.life !== undefined) player.life = patch.life;
    if (patch.poisonCounters !== undefined) player.poisonCounters = patch.poisonCounters;
    if (patch.hasPlayedLand !== undefined) player.hasPlayedLand = patch.hasPlayedLand;
    if (patch.landsPlayedThisTurn !== undefined) player.landsPlayedThisTurn = patch.landsPlayedThisTurn;
    if (patch.landPlaysAvailable !== undefined) player.landPlaysAvailable = patch.landPlaysAvailable;
    if (patch.manaPool !== undefined) player.manaPool = { ...player.manaPool, ...patch.manaPool };
    if (patch.hasLost !== undefined) player.hasLost = patch.hasLost;

    return this;
  }

  setTurn(patch: TurnStatePatch): this {
    if (patch.turnNumber !== undefined) this.state.turnNumber = patch.turnNumber;
    if (patch.activePlayer !== undefined) this.state.activePlayer = patch.activePlayer;
    if (patch.currentPhase !== undefined) this.state.currentPhase = patch.currentPhase;
    if (patch.currentStep !== undefined) this.state.currentStep = patch.currentStep;
    if (patch.priorityPlayer !== undefined) this.state.priorityPlayer = patch.priorityPlayer;
    if (patch.passedPriority !== undefined) this.state.passedPriority = new Set(patch.passedPriority);

    return this;
  }

  mutateState(mutator: (state: GameState) => void): this {
    mutator(this.state);
    return this;
  }

  build(): GameState {
    this.validate();
    return this.state;
  }

  private resolveCard(selector: CardSelector): CardInstance {
    const copies = this.cardsByOwnerAndName[selector.playerId].get(selector.name);
    const index = selector.nth ?? 0;

    if (!copies || copies.length === 0) {
      throw new Error(`Unknown card name "${selector.name}" for ${selector.playerId}.`);
    }

    const card = copies[index];
    if (!card) {
      throw new Error(`Could not find copy ${index} of "${selector.name}" for ${selector.playerId}; found ${copies.length} copy/copies.`);
    }

    return card;
  }

  private resetNonBattlefieldCardState(card: CardInstance): void {
    card.tapped = false;
    card.summoningSick = true;
    card.counters = {};
    card.markedDamage = 0;
    card.attachedTo = null;
    card.attachments = [];
    card.faceDown = false;
    card.modifiedPower = undefined;
    card.modifiedToughness = undefined;
    card.modifiedKeywords = undefined;
    card.modifiedAbilities = undefined;
  }

  private removeCardFromAllZones(objectId: string): void {
    for (const playerId of this.state.turnOrder) {
      for (const zone of ALL_ZONE_ORDER) {
        const cards = this.state.zones[playerId][zone];
        const index = cards.findIndex(card => card.objectId === objectId);
        if (index >= 0) {
          cards.splice(index, 1);
          return;
        }
      }
    }
  }

  private insertIntoZone(cards: CardInstance[], card: CardInstance, position: MoveCardOptions['position']): void {
    if (position === undefined || position === 'end' || position === 'top') {
      cards.push(card);
      return;
    }

    if (position === 'start' || position === 'bottom') {
      cards.unshift(card);
      return;
    }

    if (position < 0 || position > cards.length) {
      throw new Error(`Invalid zone position ${position}; expected a value between 0 and ${cards.length}.`);
    }

    cards.splice(position, 0, card);
  }

  private validate(): void {
    this.validateNoPerPlayerStackCards();
    this.validateCardUniqueness();
    this.validateCommanderState();
    this.validatePlayerState();
  }

  private validateNoPerPlayerStackCards(): void {
    for (const playerId of this.state.turnOrder) {
      if (this.state.zones[playerId].STACK.length > 0) {
        throw new Error(`Per-player STACK zone for ${playerId} must stay empty; use state.stack via mutateState() for advanced stack setup.`);
      }
    }
  }

  private validateCardUniqueness(): void {
    const seen = new Map<string, string>();

    for (const playerId of this.state.turnOrder) {
      for (const zone of ALL_ZONE_ORDER) {
        for (const card of this.state.zones[playerId][zone]) {
          this.validateCardLocation(card, playerId, zone);
          this.recordSeenCard(seen, card.objectId, `${playerId}.${zone}`);
        }
      }
    }

    for (const entry of this.state.stack) {
      if (!entry.cardInstance) continue;
      this.recordSeenCard(seen, entry.cardInstance.objectId, `stack:${entry.id}`);
    }

    for (const playerId of this.state.turnOrder) {
      for (const cards of this.cardsByOwnerAndName[playerId].values()) {
        for (const card of cards) {
          if (!seen.has(card.objectId)) {
            throw new Error(`Card ${this.describeCard(card)} is missing from all zones and state.stack.`);
          }
        }
      }
    }
  }

  private validateCardLocation(card: CardInstance, playerId: PlayerId, zone: Zone): void {
    if (card.zone !== zone) {
      throw new Error(`${this.describeCard(card)} is stored in ${playerId}.${zone} but reports zone ${card.zone}.`);
    }

    if (card.owner !== playerId && zone !== ZoneType.BATTLEFIELD) {
      throw new Error(`${this.describeCard(card)} cannot appear in ${playerId}.${zone}; non-battlefield zones must match card owner.`);
    }

    if (zone === ZoneType.BATTLEFIELD && card.controller !== playerId) {
      throw new Error(`${this.describeCard(card)} is stored on ${playerId}'s battlefield but is controlled by ${card.controller}.`);
    }
  }

  private recordSeenCard(seen: Map<string, string>, objectId: string, location: string): void {
    const existing = seen.get(objectId);
    if (existing) {
      throw new Error(`Card ${objectId} appears multiple times (${existing}, ${location}).`);
    }
    seen.set(objectId, location);
  }

  private validateCommanderState(): void {
    for (const playerId of this.state.turnOrder) {
      const player = this.state.players[playerId];
      const commanderIds = new Set(player.commanderIds);
      const expectedCommanderIds = this.commanderIdsByOwner[playerId];

      if (commanderIds.size !== expectedCommanderIds.size || [...expectedCommanderIds].some(id => !commanderIds.has(id))) {
        throw new Error(`Commander ids for ${playerId} do not match the deck's commander card.`);
      }

      for (const commanderId of commanderIds) {
        const commander = this.findCardAnywhere(commanderId);
        if (!commander) {
          throw new Error(`Commander ${commanderId} for ${playerId} is missing from the game state.`);
        }
        if (commander.owner !== playerId) {
          throw new Error(`Commander ${this.describeCard(commander)} has wrong owner ${commander.owner}.`);
        }
        if (commander.zone === ZoneType.STACK) {
          throw new Error(`Commander ${this.describeCard(commander)} cannot be represented in per-player STACK zone.`);
        }
      }

      for (const commanderId of Object.keys(player.commanderTimesCast)) {
        if (!commanderIds.has(commanderId)) {
          throw new Error(`Commander cast count for ${playerId} references non-commander object ${commanderId}.`);
        }
      }

      for (const card of this.state.zones[playerId].COMMAND) {
        if (!commanderIds.has(card.objectId)) {
          throw new Error(`Non-commander ${this.describeCard(card)} found in ${playerId}.COMMAND.`);
        }
      }
    }
  }

  private validatePlayerState(): void {
    for (const playerId of this.state.turnOrder) {
      const player = this.state.players[playerId];
      if (player.landPlaysAvailable < 0) {
        throw new Error(`Player ${playerId} cannot have negative landPlaysAvailable.`);
      }
      if (player.landsPlayedThisTurn < 0) {
        throw new Error(`Player ${playerId} cannot have negative landsPlayedThisTurn.`);
      }
      if (player.poisonCounters < 0) {
        throw new Error(`Player ${playerId} cannot have negative poisonCounters.`);
      }
    }
  }

  private findCardAnywhere(objectId: string): CardInstance | undefined {
    for (const playerId of this.state.turnOrder) {
      for (const zone of ALL_ZONE_ORDER) {
        const card = this.state.zones[playerId][zone].find(zoneCard => zoneCard.objectId === objectId);
        if (card) {
          return card;
        }
      }
    }

    for (const entry of this.state.stack) {
      if (entry.cardInstance?.objectId === objectId) {
        return entry.cardInstance;
      }
    }

    return undefined;
  }

  private describeCard(card: CardInstance): string {
    return `"${card.definition.name}" (${card.objectId})`;
  }
}

export function createTestGameStateBuilder(decks?: DeckConfig[]): TestGameStateBuilder {
  return new TestGameStateBuilder(decks);
}

export { NON_BATTLEFIELD_ZONES };
