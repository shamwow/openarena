import type {
  GameState, CardInstance, PlayerId, Zone, ObjectId, GameEvent, CardFilter,
} from './types';
import { GameEventType, CardType } from './types';
import {
  createCardInstance,
  findCard,
  clearExileInsteadOfDyingThisTurn,
  getEffectiveSubtypes,
  getEffectiveSupertypes,
  getNextTimestamp,
  hasType,
  shouldExileInsteadOfDyingThisTurn,
  rememberLastKnownInformation,
} from './GameState';
import type { EventBus } from './EventBus';

type CommanderReplacementResolver = (state: GameState, card: CardInstance, toZone: Zone) => boolean;

export class ZoneManager {
  private eventBus: EventBus;
  private commanderReplacementResolver?: CommanderReplacementResolver;

  constructor(eventBus: EventBus, commanderReplacementResolver?: CommanderReplacementResolver) {
    this.eventBus = eventBus;
    this.commanderReplacementResolver = commanderReplacementResolver;
  }

  moveCard(
    state: GameState,
    objectId: ObjectId,
    toZone: Zone,
    toOwner?: PlayerId,
    options?: { tapped?: boolean; faceDown?: boolean; commanderReplacementDecision?: boolean }
  ): void {
    const card = findCard(state, objectId);
    if (!card) return;

    const fromZone = card.zone;
    const leavingZoneChangeCounter = card.zoneChangeCounter;
    const fromController = card.controller;
    const replacementDecision = this.resolveCommanderReplacementDecision(state, card, toZone, options?.commanderReplacementDecision);
    let resolvedZone = replacementDecision ? 'COMMAND' : toZone;
    if (
      fromZone === 'BATTLEFIELD' &&
      resolvedZone === 'GRAVEYARD' &&
      (shouldExileInsteadOfDyingThisTurn(state, objectId, leavingZoneChangeCounter) ||
        card.exileInsteadOfDyingThisTurnZoneChangeCounter === leavingZoneChangeCounter)
    ) {
      resolvedZone = 'EXILE';
    }
    const targetOwner = replacementDecision ? card.owner : (toOwner ?? card.owner);
    const leavingSnapshot = rememberLastKnownInformation(state, card);

    // Remove from old zone
    this.removeFromZone(state, card);

    // Reset state when leaving the battlefield
    if (fromZone === 'BATTLEFIELD') {
      if (card.attachedTo) {
        const previousHost = findCard(state, card.attachedTo);
        if (previousHost) {
          previousHost.attachments = previousHost.attachments.filter(id => id !== card.objectId);
        }
      }
      card.tapped = false;
      card.markedDamage = 0;
      card.counters = {};
      card.summoningSick = true;
      card.attachedTo = null;
      card.modifiedPower = undefined;
      card.modifiedToughness = undefined;
      card.modifiedTypes = undefined;
      card.modifiedSubtypes = undefined;
      card.modifiedSupertypes = undefined;
      card.modifiedKeywords = undefined;
      card.modifiedAbilities = undefined;
      card.exileInsteadOfDyingThisTurnZoneChangeCounter = undefined;

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

    if (fromZone !== toZone) {
      card.zoneChangeCounter += 1;
    }

    if (fromZone === 'EXILE' || resolvedZone !== 'EXILE') {
      state.castPermissions = state.castPermissions.filter(permission => permission.objectId !== objectId);
    }

    // Update card zone info
    card.zone = resolvedZone;
    card.controller = targetOwner;
    card.timestamp = getNextTimestamp(state);

    if (options?.tapped) card.tapped = true;
    if (options?.faceDown) card.faceDown = true;

    if (resolvedZone === 'BATTLEFIELD') {
      if (card.definition.entersTapped) {
        card.tapped = true;
      }
      if (
        card.definition.entersTappedUnlessYouControl &&
        !this.controlsPermanentMatchingFilter(
          state,
          targetOwner,
          card.definition.entersTappedUnlessYouControl,
        )
      ) {
        card.tapped = true;
      }
      card.summoningSick = true;
      card.controller = targetOwner;

      // Planeswalker ETB: set loyalty counters to definition.loyalty
      if (hasType(card, CardType.PLANESWALKER) && card.definition.loyalty !== undefined) {
        card.counters['loyalty'] = card.definition.loyalty;
      }

      // Sagas enter with their first lore counter.
      if (card.definition.sagaChapters && card.definition.sagaChapters.length > 0) {
        card.counters.lore = Math.max(card.counters.lore ?? 0, 1);
      }

      if (card.definition.attachmentType === 'Aura' && card.attachedTo) {
        const host = findCard(state, card.attachedTo);
        if (!host || !this.isLegalAttachment(state, card, host)) {
          card.attachedTo = null;
        } else if (!host.attachments.includes(card.objectId)) {
          host.attachments.push(card.objectId);
        }
      }
    }

    // Tokens cease to exist after leaving the battlefield instead of persisting in other zones.
    if (!(card.isToken && resolvedZone !== 'BATTLEFIELD')) {
      state.zones[targetOwner][resolvedZone].push(card);
    }

    // Emit zone change event
    const zoneEvent: GameEvent = {
      type: GameEventType.ZONE_CHANGE,
      timestamp: getNextTimestamp(state),
      objectId,
      cardId: card.cardId,
      fromZone,
      toZone: resolvedZone,
      controller: targetOwner,
      objectZoneChangeCounter: leavingSnapshot.zoneChangeCounter,
      newObjectZoneChangeCounter: card.zoneChangeCounter,
      lastKnownInfo: leavingSnapshot,
    };
    state.eventLog.push(zoneEvent);
    this.eventBus.emit(zoneEvent);

    // Collect triggers for this event
    const triggers = this.eventBus.checkTriggers(zoneEvent, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    // ETB event
    if (resolvedZone === 'BATTLEFIELD') {
      const etbEvent: GameEvent = {
        type: GameEventType.ENTERS_BATTLEFIELD,
        timestamp: getNextTimestamp(state),
        objectId,
        cardId: card.cardId,
        controller: targetOwner,
        objectZoneChangeCounter: card.zoneChangeCounter,
      };
      state.eventLog.push(etbEvent);
      this.eventBus.emit(etbEvent);

      const etbTriggers = this.eventBus.checkTriggers(etbEvent, state);
      for (const t of etbTriggers) {
        state.pendingTriggers.push(t);
      }

      if (card.definition.sagaChapters && card.definition.sagaChapters.length > 0) {
        const counterEvent: GameEvent = {
          type: GameEventType.COUNTER_ADDED,
          timestamp: getNextTimestamp(state),
          objectId,
          cardId: card.cardId,
          objectZoneChangeCounter: card.zoneChangeCounter,
          counterType: 'lore',
          amount: 1,
        };
        state.eventLog.push(counterEvent);
        this.eventBus.emit(counterEvent);

        const counterTriggers = this.eventBus.checkTriggers(counterEvent, state);
        for (const t of counterTriggers) {
          state.pendingTriggers.push(t);
        }
      }
    }

    // LTB event
    if (fromZone === 'BATTLEFIELD') {
      const ltbEvent: GameEvent = {
        type: GameEventType.LEAVES_BATTLEFIELD,
        timestamp: getNextTimestamp(state),
        objectId,
        cardId: card.cardId,
        controller: fromController,
        destination: resolvedZone,
        objectZoneChangeCounter: leavingSnapshot.zoneChangeCounter,
        newObjectZoneChangeCounter: card.zoneChangeCounter,
        lastKnownInfo: leavingSnapshot,
      };
      state.eventLog.push(ltbEvent);
      this.eventBus.emit(ltbEvent);

      const ltbTriggers = this.eventBus.checkTriggers(ltbEvent, state);
        for (const t of ltbTriggers) {
          state.pendingTriggers.push(t);
        }

      // "Dies" is a specific battlefield→graveyard transition
      if (resolvedZone === 'GRAVEYARD') {
        const diesEvent: GameEvent = {
          type: GameEventType.ZONE_CHANGE,
          timestamp: getNextTimestamp(state),
          objectId,
          cardId: card.cardId,
          fromZone: 'BATTLEFIELD',
          toZone: 'GRAVEYARD',
          controller: fromController,
          objectZoneChangeCounter: leavingSnapshot.zoneChangeCounter,
          newObjectZoneChangeCounter: card.zoneChangeCounter,
          lastKnownInfo: leavingSnapshot,
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

    if (fromZone === 'BATTLEFIELD') {
      clearExileInsteadOfDyingThisTurn(state, objectId);
    }
  }

  private controlsPermanentMatchingFilter(
    state: GameState,
    controller: PlayerId,
    filter: CardFilter,
  ): boolean {
    return state.zones[controller].BATTLEFIELD.some((card) => this.matchesFilter(state, card, filter, controller));
  }

  private matchesFilter(
    state: GameState,
    card: CardInstance,
    filter: CardFilter,
    sourceController?: PlayerId,
  ): boolean {
    if (card.zone === 'BATTLEFIELD' && card.phasedOut) return false;
    if (filter.types && !filter.types.some((t) => hasType(card, t))) return false;
    if (filter.subtypes && !filter.subtypes.some((t) => getEffectiveSubtypes(card).includes(t))) return false;
    if (filter.supertypes && !filter.supertypes.some((t) => getEffectiveSupertypes(card).includes(t))) return false;
    if (filter.colors && !filter.colors.some((c) => card.definition.colorIdentity.includes(c))) return false;
    if (filter.keywords && !filter.keywords.some((k) => (card.modifiedKeywords ?? card.definition.keywords).includes(k))) return false;
    if (filter.controller === 'you' && sourceController && card.controller !== sourceController) return false;
    if (filter.controller === 'opponent' && sourceController && card.controller === sourceController) return false;
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.self === true && sourceController && card.controller !== sourceController) return false;
    if (filter.tapped === true && !card.tapped) return false;
    if (filter.tapped === false && card.tapped) return false;
    if (filter.isToken === true && !card.isToken) return false;
    if (filter.power) {
      const p = card.modifiedPower ?? card.definition.power ?? 0;
      if (filter.power.op === 'lte' && p > filter.power.value) return false;
      if (filter.power.op === 'gte' && p < filter.power.value) return false;
      if (filter.power.op === 'eq' && p !== filter.power.value) return false;
    }
    if (filter.toughness) {
      const t = card.modifiedToughness ?? card.definition.toughness ?? 0;
      if (filter.toughness.op === 'lte' && t > filter.toughness.value) return false;
      if (filter.toughness.op === 'gte' && t < filter.toughness.value) return false;
      if (filter.toughness.op === 'eq' && t !== filter.toughness.value) return false;
    }
    if (filter.custom && !filter.custom(card, state)) return false;
    return true;
  }

  drawCard(state: GameState, player: PlayerId): CardInstance | null {
    const library = state.zones[player].LIBRARY;
    if (library.length === 0) {
      state.players[player].drewFromEmptyLibrary = true;
      return null;
    }

    const card = library.pop()!;
    rememberLastKnownInformation(state, card);
    card.zone = 'HAND';
    card.zoneChangeCounter += 1;
    card.timestamp = getNextTimestamp(state);
    state.zones[player].HAND.push(card);

    const event: GameEvent = {
      type: GameEventType.DREW_CARD,
      timestamp: getNextTimestamp(state),
      player,
      objectId: card.objectId,
      cardId: card.cardId,
      objectZoneChangeCounter: card.zoneChangeCounter,
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
      cardId: findCard(state, objectId)?.cardId,
      objectZoneChangeCounter: findCard(state, objectId)?.zoneChangeCounter,
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
      return state.zones[controller].BATTLEFIELD.filter(card => !card.phasedOut);
    }
    const all: CardInstance[] = [];
    for (const pid of state.turnOrder) {
      all.push(...state.zones[pid].BATTLEFIELD.filter(card => !card.phasedOut));
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
      cardId: card.cardId,
      objectZoneChangeCounter: card.zoneChangeCounter,
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
      cardId: card.cardId,
      objectZoneChangeCounter: card.zoneChangeCounter,
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
      abilities: definition.abilities ?? [],
      keywords: definition.keywords ?? [],
      protectionFrom: definition.protectionFrom,
      wardCost: definition.wardCost,
    };

    const instance = createCardInstance(fullDef, controller, 'BATTLEFIELD', getNextTimestamp(state));
    instance.controller = controller;
    instance.isToken = true;
    state.zones[controller].BATTLEFIELD.push(instance);

    const tokenEvent: GameEvent = {
      type: GameEventType.TOKEN_CREATED,
      timestamp: getNextTimestamp(state),
      player: controller,
      objectId: instance.objectId,
    };
    state.eventLog.push(tokenEvent);
    this.eventBus.emit(tokenEvent);

    const event: GameEvent = {
      type: GameEventType.ENTERS_BATTLEFIELD,
      timestamp: getNextTimestamp(state),
      objectId: instance.objectId,
      cardId: instance.cardId,
      controller,
      objectZoneChangeCounter: instance.zoneChangeCounter,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    return instance;
  }

  peekTop(state: GameState, player: PlayerId, count: number): CardInstance[] {
    const library = state.zones[player].LIBRARY;
    const n = Math.min(count, library.length);
    // Library is stored with last element = top, so slice from the end
    return library.slice(-n).reverse();
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

  private resolveCommanderReplacementDecision(
    state: GameState,
    card: CardInstance,
    toZone: Zone,
    explicitDecision?: boolean,
  ): boolean {
    if (!this.isCommanderCard(state, card)) return false;
    if (!this.isCommanderReplacementZone(toZone)) return false;
    if (card.zone === 'COMMAND' && toZone === 'COMMAND') return false;
    if (explicitDecision !== undefined) return explicitDecision;
    return this.commanderReplacementResolver?.(state, card, toZone) ?? true;
  }

  private isCommanderCard(state: GameState, card: CardInstance): boolean {
    return state.players[card.owner].commanderIds.includes(card.cardId);
  }

  private isCommanderReplacementZone(zone: Zone): boolean {
    return zone === 'GRAVEYARD' || zone === 'EXILE' || zone === 'HAND' || zone === 'LIBRARY';
  }

  private isLegalAttachment(state: GameState, attachment: CardInstance, host: CardInstance): boolean {
    if (host.zone !== 'BATTLEFIELD' || host.phasedOut) {
      return false;
    }

    if (attachment.definition.attachmentType === 'Equipment') {
      return hasType(host, CardType.CREATURE);
    }

    if (attachment.definition.attachmentType === 'Aura' && attachment.definition.attachTarget) {
      const spec = attachment.definition.attachTarget;
      if (spec.what === 'creature' && !hasType(host, CardType.CREATURE)) {
        return false;
      }
      if (spec.what === 'permanent' && host.zone !== 'BATTLEFIELD') {
        return false;
      }
      if (spec.controller === 'you' && host.controller !== attachment.controller) {
        return false;
      }
      if (spec.controller === 'opponent' && host.controller === attachment.controller) {
        return false;
      }
      if (spec.filter?.types && !spec.filter.types.some(type => hasType(host, type))) {
        return false;
      }
      if (spec.filter?.subtypes && !spec.filter.subtypes.some(subtype => getEffectiveSubtypes(host).includes(subtype))) {
        return false;
      }
      if (spec.filter?.colors && !spec.filter.colors.some(color => host.definition.colorIdentity.includes(color))) {
        return false;
      }
      if (spec.filter?.controller === 'you' && host.controller !== attachment.controller) {
        return false;
      }
      if (spec.filter?.controller === 'opponent' && host.controller === attachment.controller) {
        return false;
      }
      if (spec.filter?.custom && !spec.filter.custom(host, state)) {
        return false;
      }
    }

    return true;
  }
}
