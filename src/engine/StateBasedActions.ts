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
        if (card.phasedOut) continue;
        const def = card.definition;
        const isCreature = def.types.includes(CardType.CREATURE);
        const isPlaneswalker = def.types.includes(CardType.PLANESWALKER);
        const isBattle = def.types.includes(CardType.BATTLE);

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
          if ((card.counters['deathtouch-damage'] ?? 0) > 0) {
            const hasIndestructible = this.hasKeyword(card, Keyword.INDESTRUCTIBLE);
            if (!hasIndestructible) {
              actions.push({ type: 'destroy', objectId: card.objectId });
            }
          }
        }

        if (isPlaneswalker) {
          // 704.5i: Planeswalker with 0 or less loyalty
          const loyalty = card.counters['loyalty'] ?? def.loyalty ?? 0;
          if (loyalty <= 0) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          }
        }

        if (isBattle) {
          const defense = card.counters.defense ?? def.defense ?? 0;
          if (defense <= 0) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          }
        }

        // 704.5m: Aura not attached to a legal permanent
        if (def.attachmentType === 'Aura' || def.subtypes.includes('Aura')) {
          if (!card.attachedTo) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          } else {
            const host = findCard(state, card.attachedTo);
            if (!host || host.zone !== 'BATTLEFIELD' || host.phasedOut || !this.isLegalAttachment(card, host)) {
              actions.push({ type: 'graveyard', objectId: card.objectId });
            }
          }
        }

        if (def.attachmentType === 'Equipment' && card.attachedTo) {
          const host = findCard(state, card.attachedTo);
          if (!host || host.zone !== 'BATTLEFIELD' || host.phasedOut || !this.isLegalAttachment(card, host)) {
            if (host) {
              host.attachments = host.attachments.filter(id => id !== card.objectId);
            }
            card.attachedTo = null;
          }
        }

        // 714.4: Saga with lore counters >= totalChapters is sacrificed
        if (def.sagaChapters && def.totalChapters) {
          const loreCounters = card.counters['lore'] ?? 0;
          const chapterStillOnStack = state.stack.some(entry =>
            entry.entryType === 'TRIGGERED_ABILITY' &&
            entry.sourceId === card.objectId &&
            entry.ability?.kind === 'triggered' &&
            entry.ability.description.startsWith('Chapter ')
          );
          if (loreCounters >= def.totalChapters && !chapterStillOnStack) {
            actions.push({ type: 'sacrifice', objectId: card.objectId, playerId: card.controller });
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
          if (this.applyRegenerationShield(state, card)) {
            break;
          }
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

      case 'sacrifice': {
        const card = findCard(state, action.objectId!);
        if (card && card.zone === 'BATTLEFIELD') {
          const event: GameEvent = {
            type: GameEventType.SACRIFICED,
            timestamp: getNextTimestamp(state),
            objectId: action.objectId!,
            controller: action.playerId!,
          };
          state.eventLog.push(event);
          this.eventBus.emit(event);
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

  private applyRegenerationShield(state: GameState, card: CardInstance): boolean {
    if ((card.counters['regeneration-shield'] ?? 0) <= 0) return false;
    if ((card.counters['cant-regenerate'] ?? 0) > 0) return false;

    card.counters['regeneration-shield'] -= 1;
    if (card.counters['regeneration-shield'] <= 0) {
      delete card.counters['regeneration-shield'];
    }
    card.tapped = true;
    card.markedDamage = 0;
    delete card.counters['deathtouch-damage'];
    this.removePermanentFromCombat(state, card.objectId);
    return true;
  }

  private removePermanentFromCombat(state: GameState, objectId: ObjectId): void {
    if (!state.combat) return;

    state.combat.attackers.delete(objectId);
    state.combat.blockers.delete(objectId);
    state.combat.blockerOrder.delete(objectId);

    for (const [attackerId, blockerIds] of state.combat.blockerOrder) {
      const nextBlockers = blockerIds.filter((blockerId) => blockerId !== objectId);
      if (nextBlockers.length === 0) {
        state.combat.blockerOrder.delete(attackerId);
      } else {
        state.combat.blockerOrder.set(attackerId, nextBlockers);
      }
    }

    for (const [blockerId, attackerId] of [...state.combat.blockers.entries()]) {
      if (blockerId === objectId || attackerId === objectId) {
        state.combat.blockers.delete(blockerId);
      }
    }
  }

  private isLegalAttachment(attachment: CardInstance, host: CardInstance): boolean {
    const attachmentType = attachment.definition.attachmentType;
    if (attachmentType === 'Equipment' && !host.definition.types.includes(CardType.CREATURE)) {
      return false;
    }
    if (attachmentType === 'Aura' && attachment.definition.attachTarget) {
      const targetSpec = attachment.definition.attachTarget;
      if (targetSpec.what === 'creature' && !host.definition.types.includes(CardType.CREATURE)) {
        return false;
      }
      if (targetSpec.filter) {
        if (targetSpec.filter.types && !targetSpec.filter.types.some(type => host.definition.types.includes(type))) {
          return false;
        }
        if (targetSpec.filter.subtypes && !targetSpec.filter.subtypes.some(subtype => host.definition.subtypes.includes(subtype))) {
          return false;
        }
        if (targetSpec.filter.colors && !targetSpec.filter.colors.some(color => host.definition.colorIdentity.includes(color))) {
          return false;
        }
      }
    }
    const protections = host.protectionFrom ?? host.definition.protectionFrom ?? [];
    if (protections.some(protection => {
      if (protection.types?.some(type => attachment.definition.types.includes(type))) return true;
      if (protection.colors?.some(color => attachment.definition.colorIdentity.includes(color))) return true;
      if (protection.custom?.(attachment)) return true;
      return false;
    })) {
      return false;
    }
    return true;
  }
}
