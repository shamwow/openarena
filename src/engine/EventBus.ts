import type {
  GameEvent, GameEventType, TriggeredAbilityDef, CardInstance,
  GameState, ReplacementEffect, PlayerId,
} from './types';

export type EventListener = (event: GameEvent) => void;

export interface PendingTrigger {
  ability: TriggeredAbilityDef;
  source: CardInstance;
  event: GameEvent;
  controller: PlayerId;
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
      const battlefield = state.zones[playerId][('BATTLEFIELD' as 'BATTLEFIELD')];
      if (!battlefield) continue;

      for (const card of battlefield) {
        for (const ability of card.definition.abilities) {
          if (ability.kind !== 'triggered') continue;
          if (this.matchesTrigger(ability.trigger, event, card, state)) {
            if (ability.interveningIf && !ability.interveningIf(state, card, event)) {
              continue;
            }
            triggers.push({
              ability,
              source: card,
              event,
              controller: card.controller,
            });
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
                source: card,
                event,
                controller: card.controller,
              });
            }
          }
        }
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
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state);

      case 'leave-battlefield':
        if (event.type !== 'LEAVES_BATTLEFIELD') return false;
        if (trigger.destination && event.destination !== trigger.destination) return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state);

      case 'cast-spell':
        if (event.type !== 'SPELL_CAST') return false;
        return this.matchesSpellFilter(trigger.filter, event, source, state);

      case 'dies':
        if (event.type !== 'ZONE_CHANGE') return false;
        if (event.fromZone !== 'BATTLEFIELD' || event.toZone !== 'GRAVEYARD') return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state);

      case 'attacks':
        if (event.type !== 'ATTACKS') return false;
        return this.matchesCardFilter(trigger.filter, event.attackerId, source, state);

      case 'blocks':
        if (event.type !== 'BLOCKS') return false;
        return this.matchesCardFilter(trigger.filter, event.blockerId, source, state);

      case 'deals-damage':
        if (event.type !== 'DAMAGE_DEALT') return false;
        if (trigger.damageType === 'combat' && !event.isCombatDamage) return false;
        if (trigger.damageType === 'noncombat' && event.isCombatDamage) return false;
        return this.matchesCardFilter(trigger.filter, event.sourceId!, source, state);

      case 'upkeep':
        if (event.type !== 'STEP_CHANGE' || event.step !== 'UPKEEP') return false;
        return this.matchesTurnOwner(trigger.whose, event.activePlayer, source.controller, state);

      case 'end-step':
        if (event.type !== 'STEP_CHANGE' || event.step !== 'END') return false;
        return this.matchesTurnOwner(trigger.whose, event.activePlayer, source.controller, state);

      case 'draw-card':
        if (event.type !== 'DREW_CARD') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller, state);

      case 'gain-life':
        if (event.type !== 'LIFE_GAINED') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller, state);

      case 'lose-life':
        if (event.type !== 'LIFE_LOST') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller, state);

      case 'discard':
        if (event.type !== 'DISCARDED') return false;
        return this.matchesPlayerFilter(trigger.whose, event.player, source.controller, state);

      case 'tap':
        if (event.type !== 'TAPPED') return false;
        return this.matchesCardFilter(trigger.filter, event.objectId, source, state);

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
    _state: GameState
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
    _state: GameState
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
    state: GameState
  ): boolean {
    if (!filter) return true;

    // Find the card in any zone
    const card = this.findCardInState(objectId, state);
    if (!card) return false;

    if (filter.self) return card.objectId === source.objectId;

    if (filter.types && !filter.types.some(t => card.definition.types.includes(t))) return false;
    if (filter.subtypes && !filter.subtypes.some(t => card.definition.subtypes.includes(t))) return false;
    if (filter.supertypes && !filter.supertypes.some(t => card.definition.supertypes.includes(t))) return false;

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
      state
    );
  }

  private findCardInState(objectId: string, state: GameState): CardInstance | undefined {
    for (const playerId of state.turnOrder) {
      for (const zone of Object.values(state.zones[playerId])) {
        const card = zone.find((c: CardInstance) => c.objectId === objectId);
        if (card) return card;
      }
    }
    // Check stack
    for (const entry of state.stack) {
      if (entry.cardInstance?.objectId === objectId) return entry.cardInstance;
    }
    return undefined;
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
