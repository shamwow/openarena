import { v4 as uuid } from 'uuid';
import type {
  GameState, StackEntry, ObjectId, PlayerId, CardInstance,
  EffectContext, ActivatedAbilityDef, TriggeredAbilityDef,
  GameEvent, ModalAbilityDef, ProtectionFrom, TargetSpec,
} from './types';
import { GameEventType, StackEntryType, CardType, Keyword } from './types';
import {
  cloneCardInstance,
  findCard,
  getNextTimestamp,
  rememberLastKnownInformation,
} from './GameState';
import type { EventBus } from './EventBus';
import type { ZoneManager } from './ZoneManager';
import type { ManaManager } from './ManaManager';

export class StackManager {
  private eventBus: EventBus;
  private zoneManager: ZoneManager;
  private manaManager: ManaManager;

  constructor(eventBus: EventBus, zoneManager: ZoneManager, manaManager: ManaManager) {
    this.eventBus = eventBus;
    this.zoneManager = zoneManager;
    this.manaManager = manaManager;
  }

  /** Push a spell onto the stack */
  castSpell(
    state: GameState,
    card: CardInstance,
    controller: PlayerId,
    targets: (ObjectId | PlayerId)[],
    xValue?: number,
    spellDefinition?: CardInstance['definition'],
  ): StackEntry {
    // Remove card from hand
    rememberLastKnownInformation(state, card);
    this.removeFromCurrentZone(state, card);
    card.zone = 'STACK';
    card.zoneChangeCounter += 1;
    card.timestamp = getNextTimestamp(state);

    // Find the spell ability
    const effectiveDefinition = spellDefinition ?? card.definition;
    const spellAbility = effectiveDefinition.abilities.find(a => a.kind === 'spell');
    const resolveEffect = spellAbility?.effect ?? (() => {});

    const entry: StackEntry = {
      id: uuid(),
      entryType: StackEntryType.SPELL,
      sourceId: card.objectId,
      sourceCardId: card.cardId,
      sourceZoneChangeCounter: card.zoneChangeCounter,
      sourceSnapshot: cloneCardInstance(card),
      controller,
      timestamp: getNextTimestamp(state),
      targets,
      targetZoneChangeCounters: this.captureTargetZoneChangeCounters(state, targets),
      targetSpecs: spellAbility?.kind === 'spell' ? spellAbility.targets : undefined,
      cardInstance: card,
      xValue,
      spellDefinition: effectiveDefinition,
      resolve: resolveEffect,
    };
    state.stack.push(entry);

    // Increment spells cast this turn for the caster (Storm tracking)
    const casterState = state.players[controller];
    if (casterState) {
      casterState.spellsCastThisTurn = (casterState.spellsCastThisTurn ?? 0) + 1;
    }

    const event: GameEvent = {
      type: GameEventType.SPELL_CAST,
      timestamp: getNextTimestamp(state),
      objectId: card.objectId,
      cardId: card.cardId,
      objectZoneChangeCounter: card.zoneChangeCounter,
      castBy: controller,
      spellTypes: effectiveDefinition.types,
      castMethod: undefined,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);

    // Check triggers for casting
    const triggers = this.eventBus.checkTriggers(event, state);
    for (const t of triggers) {
      state.pendingTriggers.push(t);
    }

    return entry;
  }

  /** Push an activated ability onto the stack */
  activateAbility(
    state: GameState,
    source: CardInstance,
    ability: ActivatedAbilityDef,
    controller: PlayerId,
    targets: (ObjectId | PlayerId)[]
  ): StackEntry | null {
    // Mana abilities don't use the stack
    if (ability.isManaAbility) {
      return null; // handled separately
    }

    const entry: StackEntry = {
      id: uuid(),
      entryType: StackEntryType.ACTIVATED_ABILITY,
      sourceId: source.objectId,
      sourceCardId: source.cardId,
      sourceZoneChangeCounter: source.zoneChangeCounter,
      sourceSnapshot: cloneCardInstance(source),
      controller,
      timestamp: getNextTimestamp(state),
      targets,
      targetZoneChangeCounters: this.captureTargetZoneChangeCounters(state, targets),
      targetSpecs: ability.targets,
      ability,
      resolve: ability.effect,
    };

    state.stack.push(entry);

    const event: GameEvent = {
      type: GameEventType.ABILITY_ACTIVATED,
      timestamp: getNextTimestamp(state),
      sourceId: source.objectId,
    } as GameEvent;
    state.eventLog.push(event);
    this.eventBus.emit(event);

    return entry;
  }

  /** Put a triggered ability on the stack */
  putTriggeredAbility(
    state: GameState,
    source: CardInstance,
    ability: TriggeredAbilityDef,
    controller: PlayerId,
    triggeringEvent: GameEvent,
    targets: (ObjectId | PlayerId)[] = []
  ): StackEntry {
    const entry: StackEntry = {
      id: uuid(),
      entryType: StackEntryType.TRIGGERED_ABILITY,
      sourceId: source.objectId,
      sourceCardId: source.cardId,
      sourceZoneChangeCounter: source.zoneChangeCounter,
      sourceSnapshot: cloneCardInstance(source),
      controller,
      timestamp: getNextTimestamp(state),
      targets,
      targetZoneChangeCounters: this.captureTargetZoneChangeCounters(state, targets),
      targetSpecs: ability.targets,
      ability,
      resolve: ability.effect,
    };

    state.stack.push(entry);
    return entry;
  }

  /** Resolve the top item on the stack */
  async resolveTop(
    state: GameState,
    makeEffectContext: (entry: StackEntry) => EffectContext
  ): Promise<void> {
    if (state.stack.length === 0) return;

    const entry = state.stack[state.stack.length - 1]!;

    // Check if targets are still legal
    if (entry.targets.length > 0 && !this.hasLegalTargets(state, entry)) {
      // Fizzle: all targets illegal
      if (entry.cardInstance) {
        this.moveCardInstanceFromStack(state, entry, this.getStackExitZone(entry, 'GRAVEYARD'), entry.cardInstance.owner);
      }

      state.stack.pop();

      const counterEvent: GameEvent = {
        type: GameEventType.SPELL_COUNTERED,
        timestamp: getNextTimestamp(state),
        objectId: entry.sourceId,
        cardId: entry.sourceCardId,
        objectZoneChangeCounter: entry.sourceZoneChangeCounter,
        lastKnownInfo: entry.sourceSnapshot,
      } as GameEvent;
      state.eventLog.push(counterEvent);
      this.eventBus.emit(counterEvent);
      return;
    }

    // Build effect context and resolve
    const ctx = makeEffectContext(entry);

    // Modal ability: execute only the selected mode effects in sequence
    const spellDefinition = entry.spellDefinition ?? entry.cardInstance?.definition;
    const ability = entry.ability ?? spellDefinition?.abilities.find(
      a => a.kind === 'modal'
    );
    if (ability && ability.kind === 'modal' && entry.modeChoices && entry.modeChoices.length > 0) {
      const modalAbility = ability as ModalAbilityDef;
      for (const modeIdx of entry.modeChoices) {
        const mode = modalAbility.modes[modeIdx];
        if (mode) {
          await mode.effect(ctx);
        }
      }
    } else if (entry.chosenHalf === 'fused' && entry.cardInstance?.definition.splitHalf) {
      // Fuse: execute both halves' effects in sequence (left then right)
      await entry.resolve(ctx);
      const rightAbility = entry.cardInstance.definition.splitHalf.abilities.find(a => a.kind === 'spell');
      if (rightAbility && rightAbility.kind === 'spell') {
        await rightAbility.effect(ctx);
      }
    } else {
      await entry.resolve(ctx);
    }

    // After resolution, handle the card
    if (entry.entryType === StackEntryType.SPELL && entry.cardInstance) {
      const card = entry.cardInstance;

      // MDFC: if cast as back face, mark as transformed so continuous effects use backFace
      if (entry.chosenFace === 'back' && card.definition.isMDFC && card.definition.backFace) {
        card.isTransformed = true;
      }

      const effectiveDef = entry.spellDefinition
        ?? ((card.isTransformed && card.definition.backFace)
          ? card.definition.backFace
          : card.definition);
      const isPermanent = effectiveDef.types.some(t =>
        t === CardType.CREATURE || t === CardType.ENCHANTMENT ||
        t === CardType.ARTIFACT || t === CardType.PLANESWALKER || t === CardType.BATTLE
      );

      // Check if the cast method has an afterResolution zone override (e.g. flashback -> EXILE)
      const altCost = entry.castMethod && card.definition.alternativeCosts
        ? card.definition.alternativeCosts.find(ac => ac.id === entry.castMethod)
        : undefined;

      if (entry.castAsAdventure) {
        // Adventure spells go to exile after resolution, marked so creature portion can be cast
        card.castAsAdventure = true;
        this.moveCardInstanceFromStack(state, entry, 'EXILE', card.owner);
      } else if (altCost?.afterResolution) {
        // Alternative cost specifies a post-resolution destination (e.g. exile for flashback)
        this.moveCardInstanceFromStack(state, entry, altCost.afterResolution, card.owner);
      } else if (isPermanent) {
        // Permanents enter the battlefield
        this.moveCardInstanceFromStack(state, entry, 'BATTLEFIELD', entry.controller, entry.battlefieldEntry);
      } else {
        // Instants and sorceries go to graveyard
        this.moveCardInstanceFromStack(state, entry, 'GRAVEYARD', card.owner);
      }
    }

    state.stack.pop();

    const resolvedEvent: GameEvent = {
      type: GameEventType.SPELL_RESOLVED,
      timestamp: getNextTimestamp(state),
      objectId: entry.sourceId,
      cardId: entry.sourceCardId,
      objectZoneChangeCounter: entry.sourceZoneChangeCounter,
      lastKnownInfo: entry.sourceSnapshot,
    } as GameEvent;
    state.eventLog.push(resolvedEvent);
    this.eventBus.emit(resolvedEvent);
  }

  /** Counter a spell or ability on the stack */
  counterSpell(state: GameState, stackEntryId: ObjectId): void {
    const idx = state.stack.findIndex(e => e.id === stackEntryId);
    if (idx < 0) return;

    const entry = state.stack[idx];

    if (entry.cardInstance) {
      this.moveCardInstanceFromStack(state, entry, this.getStackExitZone(entry, 'GRAVEYARD'), entry.cardInstance.owner);
    }

    state.stack.splice(idx, 1);

    const event: GameEvent = {
      type: GameEventType.SPELL_COUNTERED,
      timestamp: getNextTimestamp(state),
      objectId: entry.sourceId,
      cardId: entry.sourceCardId,
      objectZoneChangeCounter: entry.sourceZoneChangeCounter,
      lastKnownInfo: entry.sourceSnapshot,
    } as GameEvent;
    state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  /** Check if a split second spell is on the stack */
  hasSplitSecond(): boolean {
    // We'll implement split second tracking later when cards need it
    return false;
  }

  private hasLegalTargets(state: GameState, entry: StackEntry): boolean {
    const targetSpecs = this.getTargetSpecs(entry);
    if (targetSpecs.length === 0) {
      return true;
    }

    for (const [index, target] of entry.targets.entries()) {
      const spec = targetSpecs[index];
      if (!spec) continue;
      if (this.isTargetStillLegal(state, entry, target, spec, index)) {
        return true;
      }
    }
    return false;
  }

  private getTargetSpecs(entry: StackEntry): TargetSpec[] {
    if (entry.targetSpecs && entry.targetSpecs.length > 0) {
      return entry.targetSpecs;
    }

    const definition = entry.spellDefinition ?? entry.cardInstance?.definition;
    const modalAbility = entry.ability?.kind === 'modal'
      ? entry.ability
      : definition?.abilities.find((ability): ability is ModalAbilityDef => ability.kind === 'modal');
    if (modalAbility?.kind === 'modal' && entry.modeChoices && entry.modeChoices.length > 0) {
      return entry.modeChoices.flatMap((modeIndex) => modalAbility.modes[modeIndex]?.targets ?? []);
    }

    const directAbility = entry.ability;
    if (directAbility && 'targets' in directAbility && directAbility.targets) {
      return directAbility.targets;
    }

    const spellAbility = definition?.abilities.find((ability) => ability.kind === 'spell');
    if (spellAbility?.kind === 'spell') {
      return spellAbility.targets ?? [];
    }

    return [];
  }

  private isTargetStillLegal(
    state: GameState,
    entry: StackEntry,
    target: ObjectId | PlayerId,
    spec: TargetSpec,
    index: number,
  ): boolean {
    const source = entry.sourceSnapshot ?? entry.cardInstance;
    if (typeof target === 'string' && target.startsWith('player')) {
      if (spec.what !== 'player' && spec.what !== 'creature-or-player' && spec.what !== 'any') {
        return false;
      }
      const player = state.players[target as PlayerId];
      if (!player || player.hasLost) return false;
      if (spec.controller === 'you') return target === entry.controller;
      if (spec.controller === 'opponent') return target !== entry.controller;
      return true;
    }

    const card = findCard(state, target as string, entry.targetZoneChangeCounters?.[index] ?? undefined);
    if (!card || card.phasedOut) {
      return false;
    }
    if (!this.matchesTargetSpec(card, spec, entry.controller, state)) {
      return false;
    }
    if (!source) {
      return true;
    }
    return this.canTarget(card, source, entry.controller);
  }

  private matchesTargetSpec(candidate: CardInstance, spec: TargetSpec, controller: PlayerId, state: GameState): boolean {
    if (candidate.zone === 'BATTLEFIELD' && candidate.phasedOut) return false;
    if (spec.controller === 'you' && candidate.controller !== controller) return false;
    if (spec.controller === 'opponent' && candidate.controller === controller) return false;

    const typeChecks: Record<TargetSpec['what'], boolean> = {
      creature: candidate.definition.types.includes(CardType.CREATURE),
      player: false,
      permanent: candidate.zone === 'BATTLEFIELD',
      spell: candidate.zone === 'STACK',
      'card-in-graveyard': candidate.zone === (spec.zone ?? 'GRAVEYARD'),
      'creature-or-player': candidate.definition.types.includes(CardType.CREATURE),
      'creature-or-planeswalker': candidate.definition.types.includes(CardType.CREATURE) || candidate.definition.types.includes(CardType.PLANESWALKER),
      planeswalker: candidate.definition.types.includes(CardType.PLANESWALKER),
      any: candidate.definition.types.includes(CardType.CREATURE)
        || candidate.definition.types.includes(CardType.PLANESWALKER)
        || candidate.definition.types.includes(CardType.BATTLE),
    };

    if (!typeChecks[spec.what]) return false;
    if (spec.filter && !this.matchesCardFilter(candidate, spec.filter, controller, state)) return false;
    if (spec.custom && !spec.custom(candidate, state)) return false;
    return true;
  }

  private matchesCardFilter(
    card: CardInstance,
    filter: import('./types').CardFilter,
    sourceController: PlayerId,
    state: GameState,
  ): boolean {
    if (filter.types && !filter.types.some(type => card.definition.types.includes(type))) return false;
    if (filter.subtypes && !filter.subtypes.some(subtype => card.definition.subtypes.includes(subtype))) return false;
    if (filter.supertypes && !filter.supertypes.some(supertype => card.definition.supertypes.includes(supertype))) return false;
    if (filter.colors && !filter.colors.some(color => card.definition.colorIdentity.includes(color))) return false;
    if (filter.keywords && !filter.keywords.some(keyword => (card.modifiedKeywords ?? card.definition.keywords).includes(keyword))) return false;
    if (filter.controller === 'you' && card.controller !== sourceController) return false;
    if (filter.controller === 'opponent' && card.controller === sourceController) return false;
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.tapped === true && !card.tapped) return false;
    if (filter.tapped === false && card.tapped) return false;
    if (filter.custom && !filter.custom(card, state)) return false;
    return true;
  }

  private canTarget(candidate: CardInstance, source: CardInstance, controller: PlayerId): boolean {
    const keywords = candidate.modifiedKeywords ?? candidate.definition.keywords;
    if (keywords.includes(Keyword.SHROUD)) return false;
    if (candidate.controller !== controller && keywords.includes(Keyword.HEXPROOF)) return false;
    return !this.hasProtectionFrom(candidate, source);
  }

  private hasProtectionFrom(protectedCard: CardInstance, source: CardInstance): boolean {
    const protections: ProtectionFrom[] = protectedCard.protectionFrom ?? protectedCard.definition.protectionFrom ?? [];
    return protections.some((protection) => {
      if (protection.colors?.some(color => source.definition.colorIdentity.includes(color))) {
        return true;
      }
      if (protection.types?.some(type => source.definition.types.includes(type))) {
        return true;
      }
      return protection.custom?.(source) ?? false;
    });
  }

  private captureTargetZoneChangeCounters(
    state: GameState,
    targets: (ObjectId | PlayerId)[],
  ): Array<number | null> {
    return targets.map((target) => {
      if (typeof target === 'string' && target.startsWith('player')) {
        return null;
      }
      return findCard(state, target as string)?.zoneChangeCounter ?? null;
    });
  }

  private removeFromCurrentZone(state: GameState, card: CardInstance): void {
    for (const pid of state.turnOrder) {
      for (const zone of Object.keys(state.zones[pid])) {
        const zoneCards = state.zones[pid][zone as keyof typeof state.zones[typeof pid]];
        const idx = zoneCards.indexOf(card);
        if (idx >= 0) {
          zoneCards.splice(idx, 1);
          return;
        }
      }
    }
  }

  private moveCardInstanceFromStack(
    state: GameState,
    entry: StackEntry,
    toZone: import('./types').Zone,
    toOwner: PlayerId,
    battlefieldEntry?: StackEntry['battlefieldEntry'],
  ): void {
    const card = entry.cardInstance;
    if (!card) return;

    const fromController = card.controller;
    const leavingSnapshot = rememberLastKnownInformation(state, card);
    card.zoneChangeCounter += 1;
    card.zone = toZone;
    card.timestamp = getNextTimestamp(state);

    if (toZone === 'BATTLEFIELD') {
      card.controller = toOwner;
      card.summoningSick = true;
      if (battlefieldEntry?.tapped) {
        card.tapped = true;
      }
      if (card.definition.types.includes(CardType.PLANESWALKER) && card.definition.loyalty !== undefined) {
        card.counters.loyalty = card.definition.loyalty;
      }
      if (card.definition.types.includes(CardType.BATTLE)) {
        card.counters.defense = card.definition.defense ?? card.counters.defense ?? 0;
        card.battleProtector = this.chooseDefaultBattleProtector(state, toOwner);
      }
      state.zones[toOwner].BATTLEFIELD.push(card);
      if (battlefieldEntry?.attacking && state.combat) {
        state.combat.attackers.set(card.objectId, battlefieldEntry.attacking);
      }
      if (card.definition.attachmentType === 'Aura' && card.attachedTo) {
        const host = findCard(state, card.attachedTo);
        if (!host || host.zone !== 'BATTLEFIELD' || host.phasedOut) {
          card.attachedTo = null;
        } else if (!host.attachments.includes(card.objectId)) {
          host.attachments.push(card.objectId);
        }
      }
    } else {
      if (card.attachedTo) {
        const previousHost = findCard(state, card.attachedTo);
        if (previousHost) {
          previousHost.attachments = previousHost.attachments.filter((attachmentId) => attachmentId !== card.objectId);
        }
      }
      card.attachedTo = null;
      card.controller = card.owner;
      state.zones[card.owner][toZone].push(card);
    }

    const zoneChangeEvent: GameEvent = {
      type: GameEventType.ZONE_CHANGE,
      timestamp: getNextTimestamp(state),
      objectId: card.objectId,
      cardId: card.cardId,
      fromZone: 'STACK',
      toZone,
      controller: toZone === 'BATTLEFIELD' ? toOwner : card.owner,
      objectZoneChangeCounter: leavingSnapshot.zoneChangeCounter,
      newObjectZoneChangeCounter: card.zoneChangeCounter,
      lastKnownInfo: leavingSnapshot,
    };
    state.eventLog.push(zoneChangeEvent);
    this.eventBus.emit(zoneChangeEvent);

    const triggers = this.eventBus.checkTriggers(zoneChangeEvent, state);
    for (const trigger of triggers) {
      state.pendingTriggers.push(trigger);
    }

    if (toZone === 'BATTLEFIELD') {
      const etbEvent: GameEvent = {
        type: GameEventType.ENTERS_BATTLEFIELD,
        timestamp: getNextTimestamp(state),
        objectId: card.objectId,
        cardId: card.cardId,
        controller: toOwner,
        objectZoneChangeCounter: card.zoneChangeCounter,
      };
      state.eventLog.push(etbEvent);
      this.eventBus.emit(etbEvent);

      const etbTriggers = this.eventBus.checkTriggers(etbEvent, state);
      for (const trigger of etbTriggers) {
        state.pendingTriggers.push(trigger);
      }
    } else if (toZone === 'GRAVEYARD') {
      const graveyardEvent: GameEvent = {
        type: GameEventType.ZONE_CHANGE,
        timestamp: getNextTimestamp(state),
        objectId: card.objectId,
        cardId: card.cardId,
        fromZone: 'STACK',
        toZone,
        controller: fromController,
        objectZoneChangeCounter: leavingSnapshot.zoneChangeCounter,
        newObjectZoneChangeCounter: card.zoneChangeCounter,
        lastKnownInfo: leavingSnapshot,
      };
      state.eventLog.push(graveyardEvent);
      this.eventBus.emit(graveyardEvent);
    }
  }

  private getStackExitZone(
    entry: StackEntry,
    defaultZone: import('./types').Zone,
  ): import('./types').Zone {
    const card = entry.cardInstance;
    if (!card) return defaultZone;
    if (entry.castAsAdventure) {
      return 'EXILE';
    }
    const altCost = entry.castMethod && card.definition.alternativeCosts
      ? card.definition.alternativeCosts.find(ac => ac.id === entry.castMethod)
      : undefined;
    return altCost?.afterResolution ?? defaultZone;
  }

  private chooseDefaultBattleProtector(state: GameState, controller: PlayerId): PlayerId | null {
    return state.turnOrder.find((playerId) =>
      playerId !== controller && !state.players[playerId].hasLost
    ) ?? null;
  }
}
