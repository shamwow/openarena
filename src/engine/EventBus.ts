import type {
  GameEvent, GameEventType, TriggeredAbilityDef, CardInstance,
  GameState, ReplacementEffect, PlayerId, CounterAddedEvent, LastKnownInformation,
  WouldEnterBattlefieldEvent, WouldEnterBattlefieldReplacementEffect, WouldEnterBattlefieldReplacementResult,
} from './types';
import { CardType } from './types';
import {
  cloneCardInstance,
  findCard,
  getEffectiveAbilities,
  getEffectiveSubtypes,
  getEffectiveSupertypes,
  hasType,
  getLastKnownInformation,
} from './GameState';
import { TriggeredAbility } from './abilities';

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

  applyWouldEnterBattlefieldReplacements(
    event: WouldEnterBattlefieldEvent,
    replacements: WouldEnterBattlefieldReplacementEffect[],
    state: GameState,
  ): WouldEnterBattlefieldReplacementResult {
    let current = event;
    let applied = true;
    const appliedIds = new Set<string>();

    while (applied) {
      applied = false;
      for (const re of replacements) {
        if (appliedIds.has(re.id)) continue;
        if (!re.appliesTo(current, state)) continue;

        const result = re.replace(current, state);
        appliedIds.add(re.id);
        applied = true;

        if (result.kind !== 'enter') {
          return result;
        }

        current = result.event;
        break;
      }
    }

    return { kind: 'enter', event: current };
  }

  /** Check all triggered abilities on the battlefield against an event */
  checkTriggers(event: GameEvent, state: GameState): PendingTrigger[] {
    const triggers: PendingTrigger[] = [];
    if (!state.triggeredAbilitiesUsedThisTurn) {
      state.triggeredAbilitiesUsedThisTurn = new Set<string>();
    }

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      const battlefield = state.zones[playerId].BATTLEFIELD;
      if (!battlefield) continue;

      for (const card of battlefield) {
        if (card.phasedOut) continue;
        for (const [abilityIndex, ability] of getEffectiveAbilities(card).entries()) {
          if (ability.kind !== 'triggered') continue;
          const ta = TriggeredAbility.from(ability);
          const usageKey = `${card.objectId}:${card.zoneChangeCounter}:${abilityIndex}`;
          if (ta.isOncePerTurn() && state.triggeredAbilitiesUsedThisTurn.has(usageKey)) {
            continue;
          }
          if (ta.matches(event, card, state)) {
            if (ta.isOncePerTurn()) {
              state.triggeredAbilitiesUsedThisTurn.add(usageKey);
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
          for (const [abilityIndex, ability] of getEffectiveAbilities(card).entries()) {
            if (ability.kind !== 'triggered') continue;
            const ta = TriggeredAbility.from(ability);
            const usageKey = `${card.objectId}:${card.zoneChangeCounter}:command:${abilityIndex}`;
            if (ta.isOncePerTurn() && state.triggeredAbilitiesUsedThisTurn.has(usageKey)) {
              continue;
            }
            if (ta.matches(event, card, state)) {
              if (ta.isOncePerTurn()) {
                state.triggeredAbilitiesUsedThisTurn.add(usageKey);
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
      }
    }

    for (const delayedTrigger of state.delayedTriggers) {
      const ta = TriggeredAbility.from(delayedTrigger.ability);
      if (ta.matches(event, delayedTrigger.source, state)) {
        const usageKey = `${delayedTrigger.source.objectId}:${delayedTrigger.source.zoneChangeCounter}:delayed:${delayedTrigger.id}`;
        if (ta.isOncePerTurn() && state.triggeredAbilitiesUsedThisTurn.has(usageKey)) {
          continue;
        }
        if (ta.isOncePerTurn()) {
          state.triggeredAbilitiesUsedThisTurn.add(usageKey);
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
