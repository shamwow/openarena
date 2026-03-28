import type { GameState, PlayerId, ObjectId, CardInstance, GameEvent } from './types';
import { CardType, GameEventType } from './types';
import { findCard, getEffectiveSubtypes, getEffectiveSupertypes, hasType, getNextTimestamp } from './GameState';
import { getSurvivalRuleProfile } from './AbilityPrimitives';
import type { ZoneManager } from './ZoneManager';
import type { EventBus } from './EventBus';
import type { InteractionEngine } from './InteractionEngine';

interface SBAAction {
  type: 'player-loses' | 'destroy' | 'graveyard' | 'sacrifice' | 'remove-counters' | 'legend-rule';
  playerId?: PlayerId;
  objectId?: ObjectId;
  reason?: string;
}

export class StateBasedActions {
  private zoneManager: ZoneManager;
  private eventBus: EventBus;
  private interactionEngine: InteractionEngine;

  constructor(zoneManager: ZoneManager, eventBus: EventBus, interactionEngine: InteractionEngine) {
    this.zoneManager = zoneManager;
    this.eventBus = eventBus;
    this.interactionEngine = interactionEngine;
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
        const isCreature = hasType(card, CardType.CREATURE);
        const isPlaneswalker = hasType(card, CardType.PLANESWALKER);

        if (isCreature) {
          const toughness = card.modifiedToughness ?? def.toughness ?? 0;

          // 704.5f: Creature with 0 or less toughness
          if (toughness <= 0) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          }

          // 704.5g: Creature with lethal damage
          if (toughness > 0 && card.markedDamage >= toughness) {
            if (!getSurvivalRuleProfile(card, state).ignoreLethalDamage) {
              actions.push({ type: 'destroy', objectId: card.objectId });
            }
          }

          // 704.5h: Creature with deathtouch damage
          if ((card.counters['deathtouch-damage'] ?? 0) > 0) {
            if (!getSurvivalRuleProfile(card, state).ignoreLethalDamage) {
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

        // 704.5m: Aura not attached to a legal permanent
        if (def.attachment?.type === 'Aura' || def.subtypes.includes('Aura')) {
          if (!card.attachedTo) {
            actions.push({ type: 'graveyard', objectId: card.objectId });
          } else {
            const host = findCard(state, card.attachedTo);
            if (!host || host.zone !== 'BATTLEFIELD' || host.phasedOut || !this.isLegalAttachment(state, card, host)) {
              actions.push({ type: 'graveyard', objectId: card.objectId });
            }
          }
        }

        if (def.attachment?.type === 'Equipment' && card.attachedTo) {
          const host = findCard(state, card.attachedTo);
          if (!host || host.zone !== 'BATTLEFIELD' || host.phasedOut || !this.isLegalAttachment(state, card, host)) {
            if (host) {
              host.attachments = host.attachments.filter(id => id !== card.objectId);
            }
            card.attachedTo = null;
          }
        }

        // 714.4: Saga with lore counters >= its final chapter is sacrificed.
        const totalChapters = def.sagaChapters ? Math.max(...def.sagaChapters.map((chapter) => chapter.chapter)) : 0;
        if (def.sagaChapters && totalChapters > 0) {
          const loreCounters = card.counters['lore'] ?? 0;
          const chapterStillOnStack = state.stack.some(entry =>
            entry.entryType === 'TRIGGERED_ABILITY' &&
            entry.sourceId === card.objectId &&
            entry.ability?.kind === 'triggered' &&
            entry.ability.description.startsWith('Chapter ')
          );
          if (loreCounters >= totalChapters && !chapterStillOnStack) {
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
      if (getEffectiveSupertypes(card).includes('Legendary')) {
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

  private isLegalAttachment(state: GameState, attachment: CardInstance, host: CardInstance): boolean {
    const attachmentDef = attachment.definition.attachment;
    if (attachmentDef?.type === 'Equipment' && !hasType(host, CardType.CREATURE)) {
      return false;
    }
    if (attachmentDef?.type === 'Aura') {
      const targetSpec = attachmentDef.target;
      if (targetSpec.what === 'creature' && !hasType(host, CardType.CREATURE)) {
        return false;
      }
      if (targetSpec.filter) {
        if (targetSpec.filter.types && !targetSpec.filter.types.some(type => hasType(host, type))) {
          return false;
        }
        if (targetSpec.filter.subtypes && !targetSpec.filter.subtypes.some(subtype => getEffectiveSubtypes(host).includes(subtype))) {
          return false;
        }
        if (targetSpec.filter.colors && !targetSpec.filter.colors.some(color => host.definition.colorIdentity.includes(color))) {
          return false;
        }
      }
    }
    if (this.interactionEngine.preventsAttachment(state, attachment, host)) {
      return false;
    }
    return true;
  }
}
