import type { GameState, PlayerId, ObjectId, CardInstance, GameEvent } from './types';
import { CardType, GameEventType, Keyword } from './types';
import { findCard, getNextTimestamp } from './GameState';
import type { ZoneManager } from './ZoneManager';
import type { EventBus } from './EventBus';

interface SBAAction {
  type: 'player-loses' | 'destroy' | 'graveyard' | 'sacrifice' | 'remove-counters' | 'legend-rule';
  playerId?: PlayerId;
  objectId?: ObjectId;
  reason?: string;
}

export class StateBasedActions {
  private zoneManager: ZoneManager;
  private eventBus: EventBus;

  constructor(zoneManager: ZoneManager, eventBus: EventBus) {
    this.zoneManager = zoneManager;
    this.eventBus = eventBus;
  }

  /**
   * Check and apply state-based actions.
   * Returns true if any SBAs were performed (caller should re-check).
   */
  checkAndApply(state: GameState): boolean {
    const actions = this.check(state);
    if (actions.length === 0) return false;

    // SBAs are performed simultaneously, but we apply them sequentially
    for (const action of actions) {
      this.apply(state, action);
    }

    return true;
  }

  private check(state: GameState): SBAAction[] {
    const actions: SBAAction[] = [];

    // Check player SBAs
    for (const pid of state.turnOrder) {
      const player = state.players[pid];
      if (player.hasLost) continue;

      // 704.5a: Player at 0 or less life
      if (player.life <= 0) {
        actions.push({ type: 'player-loses', playerId: pid, reason: 'life total 0 or less' });
      }

      // 704.5b: Drew from empty library
      if (player.drewFromEmptyLibrary) {
        actions.push({ type: 'player-loses', playerId: pid, reason: 'drew from empty library' });
        player.drewFromEmptyLibrary = false;
      }

      // 704.5c: 10+ poison counters
      if (player.poisonCounters >= 10) {
        actions.push({ type: 'player-loses', playerId: pid, reason: '10 or more poison counters' });
      }

      // EDH: 21+ commander damage from a single commander
      for (const [cmdId, damage] of Object.entries(player.commanderDamageReceived)) {
        if (damage >= 21) {
          actions.push({ type: 'player-loses', playerId: pid, reason: `21+ commander damage from ${cmdId}` });
        }
      }
    }

    // Check permanent SBAs
    for (const pid of state.turnOrder) {
      const battlefield = state.zones[pid].BATTLEFIELD;
      for (const card of battlefield) {
        const def = card.definition;
        const isCreature = def.types.includes(CardType.CREATURE);
        const isPlaneswalker = def.types.includes(CardType.PLANESWALKER);

        if (isCreature) {
          const toughness = card.modifiedToughness ?? def.toughness ?? 0;

          // 704.5f: Creature with 0 or less toughness
          if (toughness <= 0) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          }

          // 704.5g: Creature with lethal damage
          if (toughness > 0 && card.markedDamage >= toughness) {
            const hasIndestructible = this.hasKeyword(card, Keyword.INDESTRUCTIBLE);
            if (!hasIndestructible) {
              actions.push({ type: 'destroy', objectId: card.objectId });
            }
          }

          // 704.5h: Creature with deathtouch damage
          // (any amount of damage from a source with deathtouch is lethal)
          // This is handled during damage dealing, not SBAs
        }

        if (isPlaneswalker) {
          // 704.5i: Planeswalker with 0 or less loyalty
          const loyalty = card.counters['loyalty'] ?? def.loyalty ?? 0;
          if (loyalty <= 0) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          }
        }

        // 704.5m: Aura not attached to legal permanent
        if (def.subtypes.includes('Aura') && card.attachedTo) {
          const host = findCard(state, card.attachedTo);
          if (!host || host.zone !== 'BATTLEFIELD') {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          }
        }

        // 704.5e: +1/+1 and -1/-1 counter annihilation
        const plus = card.counters['+1/+1'] ?? 0;
        const minus = card.counters['-1/-1'] ?? 0;
        if (plus > 0 && minus > 0) {
          const toRemove = Math.min(plus, minus);
          actions.push({ type: 'remove-counters', objectId: card.objectId });
          card.counters['+1/+1'] -= toRemove;
          card.counters['-1/-1'] -= toRemove;
          if (card.counters['+1/+1'] <= 0) delete card.counters['+1/+1'];
          if (card.counters['-1/-1'] <= 0) delete card.counters['-1/-1'];
        }
      }

      // 704.5j: Legend rule
      this.checkLegendRule(state, pid, actions);
    }

    // 704.5k: Planeswalker uniqueness rule (pre-Ixalan, now uses legend rule)
    // Modern rules use legend rule for planeswalkers with the same name

    return actions;
  }

  private checkLegendRule(state: GameState, player: PlayerId, actions: SBAAction[]): void {
    const battlefield = state.zones[player].BATTLEFIELD;
    const legendaryByName = new Map<string, CardInstance[]>();

    for (const card of battlefield) {
      if (card.definition.supertypes.includes('Legendary')) {
        const name = card.definition.name;
        if (!legendaryByName.has(name)) {
          legendaryByName.set(name, []);
        }
        legendaryByName.get(name)!.push(card);
      }
    }

    for (const [, legends] of legendaryByName) {
      if (legends.length > 1) {
        // Keep the one with highest timestamp (most recently entered), sacrifice the rest
        legends.sort((a, b) => b.timestamp - a.timestamp);
        for (let i = 1; i < legends.length; i++) {
          actions.push({ type: 'legend-rule', objectId: legends[i].objectId, playerId: player });
        }
      }
    }
  }

  private apply(state: GameState, action: SBAAction): void {
    switch (action.type) {
      case 'player-loses': {
        const player = state.players[action.playerId!];
        if (!player.hasLost) {
          player.hasLost = true;
          const event: GameEvent = {
            type: GameEventType.PLAYER_LOST,
            timestamp: getNextTimestamp(state),
            player: action.playerId!,
            reason: action.reason ?? 'state-based action',
          };
          state.eventLog.push(event);
          this.eventBus.emit(event);

          // Check if game is over (only one player left)
          const alive = state.turnOrder.filter(pid => !state.players[pid].hasLost);
          if (alive.length <= 1) {
            state.isGameOver = true;
            state.winner = alive[0] ?? null;
          }
        }
        break;
      }

      case 'destroy': {
        const card = findCard(state, action.objectId!);
        if (card && card.zone === 'BATTLEFIELD') {
          const event: GameEvent = {
            type: GameEventType.DESTROYED,
            timestamp: getNextTimestamp(state),
            objectId: action.objectId!,
          };
          state.eventLog.push(event);
          this.eventBus.emit(event);
          this.zoneManager.moveCard(state, action.objectId!, 'GRAVEYARD', card.owner);
        }
        break;
      }

      case 'graveyard': {
        const card = findCard(state, action.objectId!);
        if (card && card.zone === 'BATTLEFIELD') {
          this.zoneManager.moveCard(state, action.objectId!, 'GRAVEYARD', card.owner);
        }
        break;
      }

      case 'legend-rule': {
        const card = findCard(state, action.objectId!);
        if (card && card.zone === 'BATTLEFIELD') {
          this.zoneManager.moveCard(state, action.objectId!, 'GRAVEYARD', card.owner);
        }
        break;
      }

      case 'remove-counters':
        // Already handled inline during check
        break;
    }
  }

  private hasKeyword(card: CardInstance, keyword: Keyword): boolean {
    if (card.modifiedKeywords) {
      return card.modifiedKeywords.includes(keyword);
    }
    return card.definition.keywords.includes(keyword);
  }
}
