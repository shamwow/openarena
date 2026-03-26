import type {
  GameState, CardInstance, PlayerId, Zone, ObjectId, GameEvent,
} from './types';
import { GameEventType } from './types';
import { findCard, getNextTimestamp, createCardInstance } from './GameState';
import type { EventBus } from './EventBus';

export class ZoneManager {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  moveCard(
    state: GameState,
    objectId: ObjectId,
    toZone: Zone,
    toOwner?: PlayerId,
    options?: { tapped?: boolean; faceDown?: boolean }
  ): void {
    const card = findCard(state, objectId);
    if (!card) return;

    const fromZone = card.zone;
    const fromController = card.controller;
    const targetOwner = toOwner ?? card.owner;

    // Remove from old zone
    this.removeFromZone(state, card);

    // Reset state when leaving the battlefield
    if (fromZone === 'BATTLEFIELD') {
      card.tapped = false;
      card.markedDamage = 0;
      card.counters = {};
      card.summoningSick = true;
      card.attachedTo = null;
      card.modifiedPower = undefined;
      card.modifiedToughness = undefined;
      card.modifiedKeywords = undefined;
      card.modifiedAbilities = undefined;

      // Detach any attachments
      for (const attachId of card.attachments) {
        const attachment = findCard(state, attachId);
        if (attachment) {
          attachment.attachedTo = null;
        }
      }
      card.attachments = [];

      // Remove continuous effects sourced from this permanent
      state.continuousEffects = state.continuousEffects.filter(
        e => e.sourceId !== objectId || e.duration.type !== 'static'
      );
    }

    // Update card zone info
    card.zone = toZone;
    card.controller = targetOwner;
    card.timestamp = getNextTimestamp(state);

    if (options?.tapped) card.tapped = true;
    if (options?.faceDown) card.faceDown = true;

    if (toZone === 'BATTLEFIELD') {
      card.summoningSick = true;
      card.controller = targetOwner;
    }

    // Add to new zone
    state.zones[targetOwner][toZone].push(card);

    // Emit zone change event
    const zoneEvent: GameEvent = {
      type: GameEventType.ZONE_CHANGE,
      timestamp: getNextTimestamp(state),
      objectId,
      fromZone,
      toZone,
      controller: targetOwner,
    };
    state.eventLog.push(zoneEvent);
    this.eventBus.emit(zoneEvent);

    // Collect triggers for this event
    const triggers = this.eventBus.checkTriggers(zoneEvent, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    // ETB event
    if (toZone === 'BATTLEFIELD') {
      const etbEvent: GameEvent = {
        type: GameEventType.ENTERS_BATTLEFIELD,
        timestamp: getNextTimestamp(state),
        objectId,
        controller: targetOwner,
      };
      state.eventLog.push(etbEvent);
      this.eventBus.emit(etbEvent);

      const etbTriggers = this.eventBus.checkTriggers(etbEvent, state);
      for (const t of etbTriggers) {
        state.pendingTriggers.push(t);
      }
    }

    // LTB event
    if (fromZone === 'BATTLEFIELD') {
      const ltbEvent: GameEvent = {
        type: GameEventType.LEAVES_BATTLEFIELD,
        timestamp: getNextTimestamp(state),
        objectId,
        controller: fromController,
        destination: toZone,
      };
      state.eventLog.push(ltbEvent);
      this.eventBus.emit(ltbEvent);

      const ltbTriggers = this.eventBus.checkTriggers(ltbEvent, state);
      for (const t of ltbTriggers) {
        state.pendingTriggers.push(t);
      }

      // "Dies" is a specific battlefield→graveyard transition
      if (toZone === 'GRAVEYARD') {
        const diesEvent: GameEvent = {
          type: GameEventType.ZONE_CHANGE,
          timestamp: getNextTimestamp(state),
          objectId,
          fromZone: 'BATTLEFIELD',
          toZone: 'GRAVEYARD',
          controller: fromController,
        };
        // Check dies triggers specifically
        const diesTriggers = this.eventBus.checkTriggers(diesEvent, state);
        for (const t of diesTriggers) {
          // Avoid duplicate triggers that were already queued
          if (!state.pendingTriggers.some(pt =>
            pt.source.objectId === t.source.objectId &&
            pt.ability === t.ability
          )) {
            state.pendingTriggers.push(t);
          }
        }
      }
    }
  }

  drawCard(state: GameState, player: PlayerId): CardInstance | null {
    const library = state.zones[player].LIBRARY;
    if (library.length === 0) {
      state.players[player].drewFromEmptyLibrary = true;
      return null;
    }

    const card = library.pop()!;
    this.removeFromZone(state, card);
    card.zone = 'HAND';
    card.timestamp = getNextTimestamp(state);
    state.zones[player].HAND.push(card);

    const event: GameEvent = {
      type: GameEventType.DREW_CARD,
      timestamp: getNextTimestamp(state),
      player,
      objectId: card.objectId,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    return card;
  }

  drawCards(state: GameState, player: PlayerId, count: number): CardInstance[] {
    const drawn: CardInstance[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.drawCard(state, player);
      if (card) drawn.push(card);
    }
    return drawn;
  }

  discardCard(state: GameState, player: PlayerId, objectId: ObjectId): void {
    this.moveCard(state, objectId, 'GRAVEYARD', player);

    const event: GameEvent = {
      type: GameEventType.DISCARDED,
      timestamp: getNextTimestamp(state),
      player,
      objectId,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }
  }

  shuffleLibrary(state: GameState, player: PlayerId): void {
    const library = state.zones[player].LIBRARY;
    for (let i = library.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [library[i], library[j]] = [library[j], library[i]];
    }
  }

  getZone(state: GameState, player: PlayerId, zone: Zone): CardInstance[] {
    return state.zones[player][zone];
  }

  getBattlefield(state: GameState, controller?: PlayerId): CardInstance[] {
    if (controller) {
      return state.zones[controller].BATTLEFIELD;
    }
    const all: CardInstance[] = [];
    for (const pid of state.turnOrder) {
      all.push(...state.zones[pid].BATTLEFIELD);
    }
    return all;
  }

  tapPermanent(state: GameState, objectId: ObjectId): void {
    const card = findCard(state, objectId);
    if (!card || card.tapped) return;

    card.tapped = true;
    const event: GameEvent = {
      type: GameEventType.TAPPED,
      timestamp: getNextTimestamp(state),
      objectId,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }
  }

  untapPermanent(state: GameState, objectId: ObjectId): void {
    const card = findCard(state, objectId);
    if (!card || !card.tapped) return;

    card.tapped = false;
    const event: GameEvent = {
      type: GameEventType.UNTAPPED,
      timestamp: getNextTimestamp(state),
      objectId,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  createToken(
    state: GameState,
    controller: PlayerId,
    definition: Partial<import('./types').CardDefinition> & { name: string; types: import('./types').CardType[] }
  ): CardInstance {
    const fullDef: import('./types').CardDefinition = {
      id: `token-${definition.name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      name: definition.name,
      manaCost: definition.manaCost ?? { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 },
      colorIdentity: definition.colorIdentity ?? [],
      types: definition.types,
      supertypes: definition.supertypes ?? [],
      subtypes: definition.subtypes ?? [],
      power: definition.power,
      toughness: definition.toughness,
      oracleText: definition.oracleText ?? '',
      abilities: definition.abilities ?? [],
      keywords: definition.keywords ?? [],
    };

    const instance = createCardInstance(fullDef, controller, 'BATTLEFIELD', getNextTimestamp(state));
    instance.controller = controller;
    state.zones[controller].BATTLEFIELD.push(instance);

    const event: GameEvent = {
      type: GameEventType.ENTERS_BATTLEFIELD,
      timestamp: getNextTimestamp(state),
      objectId: instance.objectId,
      controller,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    return instance;
  }

  private removeFromZone(state: GameState, card: CardInstance): void {
    for (const pid of state.turnOrder) {
      for (const zone of Object.keys(state.zones[pid]) as Zone[]) {
        const zoneCards = state.zones[pid][zone];
        const idx = zoneCards.indexOf(card);
        if (idx >= 0) {
          zoneCards.splice(idx, 1);
          return;
        }
      }
    }
  }
}
