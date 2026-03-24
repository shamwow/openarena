import { v4 as uuid } from 'uuid';
import type {
  GameState, StackEntry, ObjectId, PlayerId, CardInstance,
  EffectContext, ActivatedAbilityDef, TriggeredAbilityDef,
  GameEvent,
} from './types';
import { GameEventType, StackEntryType, CardType } from './types';
import { findCard, getNextTimestamp } from './GameState';
import type { EventBus } from './EventBus';
import type { ZoneManager } from './ZoneManager';
export class StackManager {
  private eventBus: EventBus;
  private zoneManager: ZoneManager;

  constructor(
    eventBus: EventBus,
    zoneManager: ZoneManager,
  ) {
    this.eventBus = eventBus;
    this.zoneManager = zoneManager;
  }

  /** Push a spell onto the stack */
  castSpell(
    state: GameState,
    card: CardInstance,
    controller: PlayerId,
    targets: (ObjectId | PlayerId)[],
    xValue?: number,
  ): StackEntry {
    // Remove card from hand
    this.removeFromCurrentZone(state, card);

    // Find the spell ability
    const spellAbility = card.definition.abilities.find(a => a.kind === 'spell');
    const resolveEffect = spellAbility?.effect ?? (() => {});

    const entry: StackEntry = {
      id: uuid(),
      entryType: StackEntryType.SPELL,
      sourceId: card.objectId,
      controller,
      timestamp: getNextTimestamp(state),
      targets,
      cardInstance: card,
      xValue,
      resolve: resolveEffect,
    };

    card.zone = 'STACK';
    state.stack.push(entry);

    const event: GameEvent = {
      type: GameEventType.SPELL_CAST,
      timestamp: getNextTimestamp(state),
      objectId: card.objectId,
      castBy: controller,
      spellTypes: card.definition.types,
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
      controller,
      timestamp: getNextTimestamp(state),
      targets,
      ability,
      resolve: ability.effect,
    };

    state.stack.push(entry);

    const event: GameEvent = {
      type: GameEventType.ABILITY_ACTIVATED,
      timestamp: getNextTimestamp(state),
      sourceId: source.objectId,
    };
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
    _triggeringEvent: GameEvent,
    targets: (ObjectId | PlayerId)[] = []
  ): StackEntry {
    const entry: StackEntry = {
      id: uuid(),
      entryType: StackEntryType.TRIGGERED_ABILITY,
      sourceId: source.objectId,
      controller,
      timestamp: getNextTimestamp(state),
      targets,
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

    const entry = state.stack.pop()!;

    // Check if targets are still legal
    if (entry.targets.length > 0 && !this.hasLegalTargets(state, entry)) {
      // Fizzle: all targets illegal
      if (entry.cardInstance) {
        const isPermanent = entry.cardInstance.definition.types.some(t =>
          t === CardType.CREATURE || t === CardType.ENCHANTMENT ||
          t === CardType.ARTIFACT || t === CardType.PLANESWALKER ||
          t === CardType.LAND
        );
        if (!isPermanent) {
          this.zoneManager.moveCard(state, entry.cardInstance.objectId, 'GRAVEYARD', entry.cardInstance.owner);
        }
      }

      const counterEvent: GameEvent = {
        type: GameEventType.SPELL_COUNTERED,
        timestamp: getNextTimestamp(state),
        objectId: entry.sourceId,
      };
      state.eventLog.push(counterEvent);
      this.eventBus.emit(counterEvent);
      return;
    }

    // Build effect context and resolve
    const ctx = makeEffectContext(entry);
    await entry.resolve(ctx);

    // After resolution, handle the card
    if (entry.entryType === StackEntryType.SPELL && entry.cardInstance) {
      const card = entry.cardInstance;
      const isPermanent = card.definition.types.some(t =>
        t === CardType.CREATURE || t === CardType.ENCHANTMENT ||
        t === CardType.ARTIFACT || t === CardType.PLANESWALKER
      );

      if (isPermanent) {
        // Permanents enter the battlefield
        this.zoneManager.moveCard(state, card.objectId, 'BATTLEFIELD', entry.controller);
      } else {
        // Instants and sorceries go to graveyard
        this.zoneManager.moveCard(state, card.objectId, 'GRAVEYARD', card.owner);
      }
    }

    const resolvedEvent: GameEvent = {
      type: GameEventType.SPELL_RESOLVED,
      timestamp: getNextTimestamp(state),
      objectId: entry.sourceId,
    };
    state.eventLog.push(resolvedEvent);
    this.eventBus.emit(resolvedEvent);
  }

  /** Counter a spell or ability on the stack */
  counterSpell(state: GameState, stackEntryId: ObjectId): void {
    const idx = state.stack.findIndex(e => e.id === stackEntryId);
    if (idx < 0) return;

    const entry = state.stack.splice(idx, 1)[0];

    if (entry.cardInstance) {
      this.zoneManager.moveCard(state, entry.cardInstance.objectId, 'GRAVEYARD', entry.cardInstance.owner);
    }

    const event: GameEvent = {
      type: GameEventType.SPELL_COUNTERED,
      timestamp: getNextTimestamp(state),
      objectId: entry.sourceId,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  /** Check if a split second spell is on the stack */
  hasSplitSecond(): boolean {
    // We'll implement split second tracking later when cards need it
    return false;
  }

  private hasLegalTargets(state: GameState, entry: StackEntry): boolean {
    // Check if at least one target is still legal
    for (const target of entry.targets) {
      if (typeof target === 'string' && target.startsWith('player')) {
        // Player targets: check if player is still alive
        const player = state.players[target as PlayerId];
        if (player && !player.hasLost) return true;
      } else {
        // Card targets: check if card still exists in expected zone
        const card = findCard(state, target as string);
        if (card) return true;
      }
    }
    return false;
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
}
