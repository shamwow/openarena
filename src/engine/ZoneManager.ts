import type {
  GameState, CardInstance, PlayerId, Zone, ObjectId, GameEvent,
  BattlefieldEntryState, WouldEnterBattlefieldEvent,
  WouldEnterBattlefieldReplacementEffect, WouldEnterBattlefieldReplacementResult,
} from './types';
import { GameEventType, CardType } from './types';
import {
  cloneCardInstance,
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

  applyWouldEnterBattlefieldReplacements(
    state: GameState,
    card: CardInstance,
    nextZoneChangeCounter: number,
    fromZone: Zone | undefined,
    controller: PlayerId,
    options?: { tapped?: boolean; faceDown?: boolean; counters?: Record<string, number> },
  ): WouldEnterBattlefieldReplacementResult {
    const event = this.createWouldEnterBattlefieldEvent(
      state,
      card,
      nextZoneChangeCounter,
      fromZone,
      controller,
      options,
    );
    const replacements = [
      ...state.wouldEnterBattlefieldReplacementEffects,
      ...(options?.faceDown ? [] : this.collectSelfReplacementEffects(state, card, nextZoneChangeCounter)),
    ];
    return this.eventBus.applyWouldEnterBattlefieldReplacements(event, replacements, state);
  }

  applyBattlefieldEntryState(card: CardInstance, event: WouldEnterBattlefieldEvent): void {
    card.zone = 'BATTLEFIELD';
    card.controller = event.controller;
    card.tapped = event.entry.tapped;
    card.faceDown = event.entry.faceDown;
    card.counters = { ...event.entry.counters };
    card.attachedTo = event.entry.attachedTo;
    card.copyOf = event.entry.copyOf;
    card.isTransformed = event.entry.transformed;
    card.summoningSick = true;
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
    let targetOwner = replacementDecision ? card.owner : (toOwner ?? card.owner);
    const leavingSnapshot = rememberLastKnownInformation(state, card);
    const nextZoneChangeCounter = fromZone !== toZone ? card.zoneChangeCounter + 1 : card.zoneChangeCounter;
    let wouldEnterResult: WouldEnterBattlefieldReplacementResult | null = null;

    if (resolvedZone === 'BATTLEFIELD') {
      wouldEnterResult = this.applyWouldEnterBattlefieldReplacements(
        state,
        card,
        nextZoneChangeCounter,
        fromZone,
        targetOwner,
        {
          tapped: options?.tapped ?? false,
          faceDown: options?.faceDown ?? false,
        },
      );
      if (wouldEnterResult.kind === 'redirect') {
        resolvedZone = wouldEnterResult.toZone;
        targetOwner = wouldEnterResult.toOwner ?? card.owner;
      } else if (wouldEnterResult.kind === 'enter') {
        targetOwner = wouldEnterResult.event.controller;
      } else if (wouldEnterResult.kind === 'prevent' && !card.isToken) {
        throw new Error('would-enter-battlefield prevent results are only supported for token entries');
      }
    }

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
      card.zoneChangeCounter = nextZoneChangeCounter;
    }

    if (fromZone === 'EXILE' || resolvedZone !== 'EXILE') {
      state.castPermissions = state.castPermissions.filter(permission => permission.objectId !== objectId);
    }

    // Update card zone info
    card.zone = resolvedZone;
    card.controller = targetOwner;
    card.timestamp = getNextTimestamp(state);
    if (resolvedZone === 'BATTLEFIELD' && wouldEnterResult?.kind === 'enter') {
      this.applyBattlefieldEntryState(card, wouldEnterResult.event);
      if (card.definition.attachment?.type === 'Aura' && card.attachedTo) {
        const host = findCard(state, card.attachedTo);
        if (!host || !this.isLegalAttachment(state, card, host)) {
          card.attachedTo = null;
        } else if (!host.attachments.includes(card.objectId)) {
          host.attachments.push(card.objectId);
        }
      }
    } else {
      this.clearBattlefieldEntryState(card);
    }

    // Tokens cease to exist after leaving the battlefield instead of persisting in other zones.
    if (wouldEnterResult?.kind !== 'prevent' && !(card.isToken && resolvedZone !== 'BATTLEFIELD')) {
      state.zones[targetOwner][resolvedZone].push(card);
    }

    if (wouldEnterResult?.kind === 'prevent') {
      if (fromZone === 'BATTLEFIELD') {
        clearExileInsteadOfDyingThisTurn(state, objectId);
      }
      return;
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
    if (resolvedZone === 'BATTLEFIELD' && wouldEnterResult?.kind === 'enter') {
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
    definition: Partial<import('./types').CardDefinition> & { name: string; types: import('./types').CardType[] },
    options?: { copyOf?: ObjectId },
  ): CardInstance {
    const fullDef: import('./types').CardDefinition = {
      id: `token-${definition.name.toLowerCase().replace(/\s/g, '-')}-${Date.now()}`,
      name: definition.name,
      manaCost: definition.manaCost ?? { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 },
      colorIdentity: definition.colorIdentity ?? [],
      commanderOptions: definition.commanderOptions,
      types: definition.types,
      supertypes: definition.supertypes ?? [],
      subtypes: definition.subtypes ?? [],
      power: definition.power,
      toughness: definition.toughness,
      loyalty: definition.loyalty,
      spell: definition.spell,
      spellCastBehaviors: definition.spellCastBehaviors,
      spellCostMechanics: definition.spellCostMechanics,
      abilities: definition.abilities ?? [],
      attachment: definition.attachment,
      alternativeCosts: definition.alternativeCosts,
      additionalCosts: definition.additionalCosts,
      castCostAdjustments: definition.castCostAdjustments,
      backFace: definition.backFace,
      isMDFC: definition.isMDFC,
      sagaChapters: definition.sagaChapters,
      adventure: definition.adventure,
      splitHalf: definition.splitHalf,
      hasFuse: definition.hasFuse,
      morphCost: definition.morphCost,
      suspend: definition.suspend,
    };

    const instance = createCardInstance(fullDef, controller, 'BATTLEFIELD', getNextTimestamp(state));
    instance.controller = controller;
    instance.isToken = true;
    if (options?.copyOf) {
      instance.copyOf = options.copyOf;
    }
    const wouldEnter = this.applyWouldEnterBattlefieldReplacements(
      state,
      instance,
      instance.zoneChangeCounter,
      undefined,
      controller,
    );
    if (wouldEnter.kind === 'enter') {
      this.applyBattlefieldEntryState(instance, wouldEnter.event);
      state.zones[wouldEnter.event.controller].BATTLEFIELD.push(instance);
    } else if (wouldEnter.kind === 'redirect') {
      instance.zone = wouldEnter.toZone;
      instance.controller = wouldEnter.toOwner ?? controller;
      this.clearBattlefieldEntryState(instance);
    } else {
      this.clearBattlefieldEntryState(instance);
    }

    const tokenEvent: GameEvent = {
      type: GameEventType.TOKEN_CREATED,
      timestamp: getNextTimestamp(state),
      player: controller,
      objectId: instance.objectId,
    };
    state.eventLog.push(tokenEvent);
    this.eventBus.emit(tokenEvent);

    if (wouldEnter.kind === 'enter') {
      const event: GameEvent = {
        type: GameEventType.ENTERS_BATTLEFIELD,
        timestamp: getNextTimestamp(state),
        objectId: instance.objectId,
        cardId: instance.cardId,
        controller: instance.controller,
        objectZoneChangeCounter: instance.zoneChangeCounter,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);

      const triggers = this.eventBus.checkTriggers(event, state);
      for (const t of triggers) {
        state.pendingTriggers.push(t);
      }
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

  private createWouldEnterBattlefieldEvent(
    state: GameState,
    card: CardInstance,
    nextZoneChangeCounter: number,
    fromZone: Zone | undefined,
    controller: PlayerId,
    options?: { tapped?: boolean; faceDown?: boolean; counters?: Record<string, number> },
  ): WouldEnterBattlefieldEvent {
    const entry = this.createBattlefieldEntryState(card, options);
    const entering = cloneCardInstance(card);
    entering.zone = 'BATTLEFIELD';
    entering.zoneChangeCounter = nextZoneChangeCounter;
    entering.controller = controller;
    entering.tapped = entry.tapped;
    entering.faceDown = entry.faceDown;
    entering.counters = { ...entry.counters };
    entering.attachedTo = entry.attachedTo;
    entering.copyOf = entry.copyOf;
    entering.isTransformed = entry.transformed;

    return {
      type: GameEventType.WOULD_ENTER_BATTLEFIELD,
      timestamp: getNextTimestamp(state),
      objectId: card.objectId,
      cardId: card.cardId,
      objectZoneChangeCounter: nextZoneChangeCounter,
      fromZone,
      controller,
      entering,
      entry,
    };
  }

  private createBattlefieldEntryState(
    card: CardInstance,
    options?: { tapped?: boolean; faceDown?: boolean; counters?: Record<string, number> },
  ): BattlefieldEntryState {
    const entry: BattlefieldEntryState = {
      tapped: options?.tapped ?? false,
      faceDown: options?.faceDown ?? false,
      counters: {
        ...card.counters,
        ...(options?.counters ?? {}),
      },
      attachedTo: card.attachedTo,
      copyOf: card.copyOf,
      transformed: card.isTransformed,
    };

    if (!entry.faceDown) {
      if (hasType(card, CardType.PLANESWALKER) && card.definition.loyalty !== undefined) {
        entry.counters.loyalty = Math.max(entry.counters.loyalty ?? 0, card.definition.loyalty);
      }
      if (card.definition.sagaChapters && card.definition.sagaChapters.length > 0) {
        entry.counters.lore = Math.max(entry.counters.lore ?? 0, 1);
      }
    }

    return entry;
  }

  private clearBattlefieldEntryState(card: CardInstance): void {
    card.tapped = false;
    card.faceDown = false;
    card.counters = {};
    card.attachedTo = null;
    delete card.copyOf;
    delete card.isTransformed;
  }

  private collectSelfReplacementEffects(
    state: GameState,
    card: CardInstance,
    nextZoneChangeCounter: number,
  ): WouldEnterBattlefieldReplacementEffect[] {
    if (card.faceDown) {
      return [];
    }

    const replacements: WouldEnterBattlefieldReplacementEffect[] = [];
    const abilities = card.modifiedAbilities ?? card.definition.abilities;

    for (const [index, ability] of abilities.entries()) {
      if (ability.kind !== 'static') continue;
      if (ability.condition && !ability.condition(state, card)) continue;
      const effect = ability.effect;
      if (effect.type !== 'replacement' || effect.replaces !== 'would-enter-battlefield' || !effect.selfReplacement) continue;

      replacements.push({
        id: `${card.objectId}:${nextZoneChangeCounter}:self-replacement:${index}`,
        sourceId: card.objectId,
        isSelfReplacement: true,
        appliesTo: event =>
          event.objectId === card.objectId &&
          event.objectZoneChangeCounter === nextZoneChangeCounter,
        replace: (event, game) => effect.replace(game, card, event),
      });
    }

    return replacements;
  }

  private isLegalAttachment(state: GameState, attachment: CardInstance, host: CardInstance): boolean {
    if (host.zone !== 'BATTLEFIELD' || host.phasedOut) {
      return false;
    }

    if (attachment.definition.attachment?.type === 'Equipment') {
      return hasType(host, CardType.CREATURE);
    }

    if (attachment.definition.attachment?.type === 'Aura') {
      const spec = attachment.definition.attachment.target;
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
