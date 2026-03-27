import type {
  GameEvent, GameEventType, TriggeredAbilityDef, CardInstance,
  GameState, ReplacementEffect, PlayerId, CounterAddedEvent, LastKnownInformation,
} from './types';
import { CardType } from './types';
import {
  cloneCardInstance,
  findCard,
  getEffectiveSubtypes,
  getEffectiveSupertypes,
  hasType,
  getLastKnownInformation,
} from './GameState';

export type EventListener = (event: GameEvent) => void;

export interface PendingTrigger {
  ability: TriggeredAbilityDef;
  source: CardInstance;
  event: GameEvent;
  controller: PlayerId;
  delayedTriggerId?: string;
}

export class EventBus {
  private listeners: Map<GameEventType, EventListener[]> = new Map();
  private globalListeners: EventListener[] = [];
  private triggerQueue: PendingTrigger[] = [];

  on(eventType: GameEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
    return () => {
      const arr = this.listeners.get(eventType);
      if (arr) {
        const idx = arr.indexOf(listener);
        if (idx >= 0) arr.splice(idx, 1);
      }
    };
  }

  onAny(listener: EventListener): () => void {
    this.globalListeners.push(listener);
    return () => {
      const idx = this.globalListeners.indexOf(listener);
      if (idx >= 0) this.globalListeners.splice(idx, 1);
    };
  }

  emit(event: GameEvent): void {
    const typed = this.listeners.get(event.type);
    if (typed) {
      for (const listener of typed) {
        listener(event);
      }
    }
    for (const listener of this.globalListeners) {
      listener(event);
    }
  }

  /** Apply replacement effects to an event. Returns modified event or null if prevented. */
  applyReplacements(
    event: GameEvent,
    replacements: ReplacementEffect[],
    state: GameState
  ): GameEvent | null {
    let current: GameEvent | null = event;
    let applied = true;
    const appliedIds = new Set<string>();

    while (applied && current !== null) {
      applied = false;
      for (const re of replacements) {
        if (appliedIds.has(re.id)) continue;
        if (!re.appliesTo(current, state)) continue;

        const result = re.replace(current, state);
        appliedIds.add(re.id);
        applied = true;

        if (result === null) {
          return null; // event prevented
        }
        if (Array.isArray(result)) {
          // Multiple replacement events - just use first for now
          current = result[0] ?? null;
        } else {
          current = result;
        }
        break; // restart the loop after applying one replacement
      }
    }

    return current;
  }

  /** Check all triggered abilities on the battlefield against an event */
  checkTriggers(event: GameEvent, state: GameState): PendingTrigger[] {
    const triggers: PendingTrigger[] = [];

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      const battlefield = state.zones[playerId].BATTLEFIELD;
      if (!battlefield) continue;

      for (const card of battlefield) {
        if (card.phasedOut) continue;
        for (const ability of card.definition.abilities) {
          if (ability.kind !== 'triggered') continue;
          if (this.matchesTrigger(ability.trigger, event, card, state)) {
            if (ability.interveningIf && !ability.interveningIf(state, card, event)) {
              continue;
            }
            triggers.push({
              ability,
              source: cloneCardInstance(card),
              event,
              controller: card.controller,
            });
          }
        }
      }

      // Saga chapter triggers: when a lore counter is added, check for matching chapter
      if (event.type === 'COUNTER_ADDED') {
        const counterEvent = event as CounterAddedEvent;
        if (counterEvent.counterType === 'lore') {
          for (const card of battlefield) {
            if (card.objectId !== counterEvent.objectId) continue;
            if (!card.definition.sagaChapters) continue;
            const currentLore = card.counters['lore'] ?? 0;
            const matchingChapter = card.definition.sagaChapters.find(
              ch => ch.chapter === currentLore
            );
            if (matchingChapter) {
              const sagaTrigger: TriggeredAbilityDef = {
                kind: 'triggered',
                trigger: { on: 'counter-placed', counterType: 'lore' },
                effect: matchingChapter.effect,
                optional: false,
                description: `Chapter ${matchingChapter.chapter}`,
              };
              triggers.push({
                ability: sagaTrigger,
                source: cloneCardInstance(card),
                event,
                controller: card.controller,
              });
            }
          }
        }
      }

      // Also check command zone
      const commandZone = state.zones[playerId]['COMMAND'];
      if (commandZone) {
        for (const card of commandZone) {
          for (const ability of card.definition.abilities) {
            if (ability.kind !== 'triggered') continue;
            if (this.matchesTrigger(ability.trigger, event, card, state)) {
              triggers.push({
                ability,
                source: cloneCardInstance(card),
                event,
                controller: card.controller,
              });
            }
          }
        }
      }
    }

    for (const delayedTrigger of state.delayedTriggers) {
      if (this.matchesTrigger(delayedTrigger.ability.trigger, event, delayedTrigger.source, state)) {
        if (delayedTrigger.ability.interveningIf && !delayedTrigger.ability.interveningIf(state, delayedTrigger.source, event)) {
          continue;
        }
        triggers.push({
          ability: delayedTrigger.ability,
          source: cloneCardInstance(delayedTrigger.source),
          event,
          controller: delayedTrigger.controller,
          delayedTriggerId: delayedTrigger.id,
        });
      }
    }

    return triggers;
  }

  private matchesTrigger(
    trigger: TriggeredAbilityDef['trigger'],
    event: GameEvent,
    source: CardInstance,
    state: GameState
  ): boolean {
    switch (trigger.on) {
      case 'enter-battlefield':
        if (event.type !== 'ENTERS_BATTLEFIELD') return false;
        return this.matchesCardFilter(
          trigger.filter,
          event.objectId,
          source,
          state,
          event.objectZoneChangeCounter,
          event.lastKnownInfo,
        );

      case 'leave-battlefield':
        if (event.type !== 'LEAVES_BATTLEFIELD') return false;
        if (trigger.destination && event.destination !== trigger.destination) return false;
        return this.matchesCardFilter(
          trigger.filter,
          event.objectId,
          source,
          state,
          event.objectZoneChangeCounter,
          event.lastKnownInfo,
        );

      case 'cast-spell':
        if (event.type !== 'SPELL_CAST') return false;
        return this.matchesSpellFilter(trigger.filter, event, source, state);

      case 'dies':
        if (event.type !== 'ZONE_CHANGE') return false;
        if (event.fromZone !== 'BATTLEFIELD' || event.toZone !== 'GRAVEYARD') return false;
        return this.matchesCardFilter(
          trigger.filter,
          event.objectId,
          source,
          state,
          event.objectZoneChangeCounter,
          event.lastKnownInfo,
        );

      case 'attacks':
        if (event.type !== 'ATTACKS') return false;
        return this.matchesCardFilter(trigger.filter, event.attackerId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'blocks':
        if (event.type !== 'BLOCKS') return false;
        return this.matchesCardFilter(trigger.filter, event.blockerId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'deals-damage':
        if (event.type !== 'DAMAGE_DEALT') return false;
        if (trigger.damageType === 'combat' && !event.isCombatDamage) return false;
        if (trigger.damageType === 'noncombat' && event.isCombatDamage) return false;
        return this.matchesCardFilter(
          trigger.filter,
          event.sourceId!,
          source,
          state,
          event.sourceZoneChangeCounter,
          event.lastKnownInfo,
        );

      case 'upkeep':
        if (event.type !== 'STEP_CHANGE' || event.step !== 'UPKEEP') return false;
        return this.matchesTurnOwner(trigger.whose, event.activePlayer, source.controller);

      case 'end-step':
        if (event.type !== 'STEP_CHANGE' || event.step !== 'END') return false;
        return this.matchesTurnOwner(trigger.whose, event.activePlayer, source.controller);

      case 'draw-card':
        if (event.type !== 'DREW_CARD') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'gain-life':
        if (event.type !== 'LIFE_GAINED') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'lose-life':
        if (event.type !== 'LIFE_LOST') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'discard':
        if (event.type !== 'DISCARDED') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'landfall':
        if (event.type !== 'ZONE_CHANGE') return false;
        if (event.fromZone === 'BATTLEFIELD' || event.toZone !== 'BATTLEFIELD') return false;
        if (trigger.whose === 'opponents') {
          return this.matchesCardFilter(
            { types: [CardType.LAND], controller: 'opponent' },
            event.objectId,
            source,
            state,
            event.newObjectZoneChangeCounter,
            findCard(state, event.objectId, event.newObjectZoneChangeCounter) ?? event.lastKnownInfo,
          );
        }
        if (trigger.whose === 'any') {
          return this.matchesCardFilter(
            { types: [CardType.LAND] },
            event.objectId,
            source,
            state,
            event.newObjectZoneChangeCounter,
            findCard(state, event.objectId, event.newObjectZoneChangeCounter) ?? event.lastKnownInfo,
          );
        }
        return this.matchesCardFilter(
          { types: [CardType.LAND], controller: 'you' },
          event.objectId,
          source,
          state,
          event.newObjectZoneChangeCounter,
          findCard(state, event.objectId, event.newObjectZoneChangeCounter) ?? event.lastKnownInfo,
        );

      case 'tap':
        if (event.type !== 'TAPPED') return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'tap-for-mana':
        if (event.type !== 'TAPPED_FOR_MANA') return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'untap':
        if (event.type !== 'UNTAPPED') return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'counter-placed':
        if (event.type !== 'COUNTER_ADDED') return false;
        if (trigger.counterType && event.counterType !== trigger.counterType) return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'custom':
        return trigger.match(event, source, state);

      default:
        return false;
    }
  }

  private matchesTurnOwner(
    whose: 'yours' | 'each' | 'opponents' | undefined,
    activePlayer: PlayerId,
    sourceController: PlayerId,
  ): boolean {
    if (!whose || whose === 'each') return true;
    if (whose === 'yours') return activePlayer === sourceController;
    if (whose === 'opponents') return activePlayer !== sourceController;
    return true;
  }

  private matchesPlayerFilter(
    whose: 'yours' | 'opponents' | 'any' | undefined,
    eventPlayer: PlayerId,
    sourceController: PlayerId,
  ): boolean {
    if (!whose || whose === 'any') return true;
    if (whose === 'yours') return eventPlayer === sourceController;
    if (whose === 'opponents') return eventPlayer !== sourceController;
    return true;
  }

  private matchesCardFilter(
    filter: import('./types').CardFilter | undefined,
    objectId: string,
    source: CardInstance,
    state: GameState,
    zoneChangeCounter?: number,
    fallback?: LastKnownInformation,
  ): boolean {
    if (!filter) return true;

    const card = this.resolveCardReference(objectId, state, zoneChangeCounter, fallback);
    if (!card) return false;

    if (filter.self) {
      return card.objectId === source.objectId && card.zoneChangeCounter === source.zoneChangeCounter;
    }

    if (filter.types && !filter.types.some(t => hasType(card, t))) return false;
    if (filter.subtypes && !filter.subtypes.some(t => getEffectiveSubtypes(card).includes(t))) return false;
    if (filter.supertypes && !filter.supertypes.some(t => getEffectiveSupertypes(card).includes(t))) return false;

    if (filter.controller === 'you' && card.controller !== source.controller) return false;
    if (filter.controller === 'opponent' && card.controller === source.controller) return false;

    if (filter.name && card.definition.name !== filter.name) return false;

    if (filter.power) {
      const p = card.modifiedPower ?? card.definition.power ?? 0;
      if (!this.compareNum(p, filter.power.op, filter.power.value)) return false;
    }
    if (filter.toughness) {
      const t = card.modifiedToughness ?? card.definition.toughness ?? 0;
      if (!this.compareNum(t, filter.toughness.op, filter.toughness.value)) return false;
    }

    if (filter.tapped !== undefined && card.tapped !== filter.tapped) return false;
    if (filter.custom && !filter.custom(card, state)) return false;

    return true;
  }

  private matchesSpellFilter(
    filter: import('./types').SpellFilter | undefined,
    event: import('./types').SpellCastEvent,
    source: CardInstance,
    state: GameState
  ): boolean {
    if (!filter) return true;

    if (filter.controller === 'opponent' && event.castBy === source.controller) return false;
    if (filter.controller === 'you' && event.castBy !== source.controller) return false;

    if (filter.types && !filter.types.some(t => event.spellTypes.includes(t))) return false;

    // Delegate other filters to card filter
    return this.matchesCardFilter(
      { ...filter, controller: undefined, types: undefined },
      event.objectId,
      source,
      state,
      event.objectZoneChangeCounter,
      event.lastKnownInfo,
    );
  }

  private resolveCardReference(
    objectId: string,
    state: GameState,
    zoneChangeCounter?: number,
    fallback?: LastKnownInformation,
  ): CardInstance | LastKnownInformation | undefined {
    return (
      findCard(state, objectId, zoneChangeCounter)
      ?? getLastKnownInformation(state, objectId, zoneChangeCounter)
      ?? fallback
    );
  }

  private compareNum(a: number, op: 'lte' | 'gte' | 'eq', b: number): boolean {
    switch (op) {
      case 'lte': return a <= b;
      case 'gte': return a >= b;
      case 'eq': return a === b;
    }
  }

  clearTriggerQueue(): PendingTrigger[] {
    const triggers = [...this.triggerQueue];
    this.triggerQueue = [];
    return triggers;
  }

  addPendingTrigger(trigger: PendingTrigger): void {
    this.triggerQueue.push(trigger);
  }

  removeAllListeners(): void {
    this.listeners.clear();
    this.globalListeners = [];
  }
}
