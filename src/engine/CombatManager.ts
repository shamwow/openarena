import type {
  GameState, PlayerId, ObjectId, CardInstance, DamageAssignment, GameEvent,
} from './types';
import { CardType, Keyword, GameEventType } from './types';
import { findCard, getNextTimestamp } from './GameState';
import type { EventBus } from './EventBus';
import type { ZoneManager } from './ZoneManager';

export class CombatManager {
  private eventBus: EventBus;
  private zoneManager: ZoneManager;

  constructor(eventBus: EventBus, zoneManager: ZoneManager) {
    this.eventBus = eventBus;
    this.zoneManager = zoneManager;
  }

  /** Start combat phase — initialize combat state */
  beginCombat(state: GameState): void {
    state.combat = {
      attackingPlayer: state.activePlayer,
      attackers: new Map(),
      blockers: new Map(),
      blockerOrder: new Map(),
      damageAssignments: [],
      firstStrikeDamageDealt: false,
    };
  }

  /** Declare attackers for multiplayer combat */
  declareAttackers(
    state: GameState,
    declarations: Array<{ attackerId: ObjectId; defendingPlayer: PlayerId }>
  ): boolean {
    if (!state.combat) return false;

    for (const decl of declarations) {
      const card = findCard(state, decl.attackerId);
      if (!card) continue;
      if (!this.canAttack(card, state)) continue;

      // Tap the attacker (unless it has vigilance)
      if (!this.hasKeyword(card, Keyword.VIGILANCE)) {
        card.tapped = true;
        const tapEvent: GameEvent = {
          type: GameEventType.TAPPED,
          timestamp: getNextTimestamp(state),
          objectId: card.objectId,
        };
        state.eventLog.push(tapEvent);
        this.eventBus.emit(tapEvent);
      }

      state.combat.attackers.set(card.objectId, {
        type: 'player',
        id: decl.defendingPlayer,
      });

      const event: GameEvent = {
        type: GameEventType.ATTACKS,
        timestamp: getNextTimestamp(state),
        attackerId: card.objectId,
        defendingPlayer: decl.defendingPlayer,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);

      const triggers = this.eventBus.checkTriggers(event, state);
      for (const t of triggers) {
        state.pendingTriggers.push(t);
      }
    }

    return true;
  }

  /** Declare blockers */
  declareBlockers(
    state: GameState,
    declarations: Array<{ blockerId: ObjectId; attackerId: ObjectId }>
  ): boolean {
    if (!state.combat) return false;

    for (const decl of declarations) {
      const blocker = findCard(state, decl.blockerId);
      const attacker = findCard(state, decl.attackerId);
      if (!blocker || !attacker) continue;
      if (!this.canBlock(blocker, attacker)) continue;

      state.combat.blockers.set(blocker.objectId, attacker.objectId);

      const event: GameEvent = {
        type: GameEventType.BLOCKS,
        timestamp: getNextTimestamp(state),
        blockerId: blocker.objectId,
        attackerId: attacker.objectId,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);

      const triggers = this.eventBus.checkTriggers(event, state);
      for (const t of triggers) {
        state.pendingTriggers.push(t);
      }
    }

    // Build blocker ordering for each attacker
    for (const [attackerId] of state.combat.attackers) {
      const blockersForAttacker: ObjectId[] = [];
      for (const [blockerId, blockedAttackerId] of state.combat.blockers) {
        if (blockedAttackerId === attackerId) {
          blockersForAttacker.push(blockerId);
        }
      }
      if (blockersForAttacker.length > 0) {
        state.combat.blockerOrder.set(attackerId, blockersForAttacker);
      }
    }

    return true;
  }

  /** Check if a creature needs first-strike damage step */
  needsFirstStrikeDamageStep(state: GameState): boolean {
    if (!state.combat) return false;

    for (const [attackerId] of state.combat.attackers) {
      const card = findCard(state, attackerId);
      if (card && (this.hasKeyword(card, Keyword.FIRST_STRIKE) || this.hasKeyword(card, Keyword.DOUBLE_STRIKE))) {
        return true;
      }
    }

    for (const [blockerId] of state.combat.blockers) {
      const card = findCard(state, blockerId);
      if (card && (this.hasKeyword(card, Keyword.FIRST_STRIKE) || this.hasKeyword(card, Keyword.DOUBLE_STRIKE))) {
        return true;
      }
    }

    return false;
  }

  /** Assign and deal combat damage */
  dealCombatDamage(state: GameState, isFirstStrike: boolean): void {
    if (!state.combat) return;

    const assignments: DamageAssignment[] = [];

    for (const [attackerId, target] of state.combat.attackers) {
      const attacker = findCard(state, attackerId);
      if (!attacker || attacker.zone !== 'BATTLEFIELD') continue;

      const power = attacker.modifiedPower ?? attacker.definition.power ?? 0;
      if (power <= 0) continue;

      const hasFirstStrike = this.hasKeyword(attacker, Keyword.FIRST_STRIKE);
      const hasDoubleStrike = this.hasKeyword(attacker, Keyword.DOUBLE_STRIKE);

      // First-strike step: only first strike and double strike creatures deal damage
      if (isFirstStrike && !hasFirstStrike && !hasDoubleStrike) continue;
      // Regular step: skip first-strike-only creatures (they already dealt damage)
      if (!isFirstStrike && hasFirstStrike && !hasDoubleStrike && state.combat.firstStrikeDamageDealt) continue;

      const blockerIds = state.combat.blockerOrder.get(attackerId);

      if (!blockerIds || blockerIds.length === 0) {
        // Unblocked — damage goes to defending player
        assignments.push({
          sourceId: attackerId,
          targetId: target.id,
          amount: power,
        });
      } else {
        // Blocked — distribute damage among blockers
        let remainingDamage = power;
        const hasTrample = this.hasKeyword(attacker, Keyword.TRAMPLE);
        const hasDeathtouch = this.hasKeyword(attacker, Keyword.DEATHTOUCH);

        for (const blockerId of blockerIds) {
          const blocker = findCard(state, blockerId);
          if (!blocker || blocker.zone !== 'BATTLEFIELD') continue;

          const blockerToughness = blocker.modifiedToughness ?? blocker.definition.toughness ?? 0;
          const lethalDamage = hasDeathtouch ? 1 : Math.max(0, blockerToughness - blocker.markedDamage);
          const damageToBlocker = Math.min(remainingDamage, lethalDamage);

          if (damageToBlocker > 0) {
            assignments.push({
              sourceId: attackerId,
              targetId: blockerId,
              amount: damageToBlocker,
            });
            remainingDamage -= damageToBlocker;
          }
        }

        // Trample: remaining damage goes to defending player
        if (hasTrample && remainingDamage > 0) {
          assignments.push({
            sourceId: attackerId,
            targetId: target.id,
            amount: remainingDamage,
          });
        }
      }
    }

    // Blockers deal damage to attackers
    for (const [blockerId, attackerId] of state.combat.blockers) {
      const blocker = findCard(state, blockerId);
      if (!blocker || blocker.zone !== 'BATTLEFIELD') continue;

      const power = blocker.modifiedPower ?? blocker.definition.power ?? 0;
      if (power <= 0) continue;

      const hasFirstStrike = this.hasKeyword(blocker, Keyword.FIRST_STRIKE);
      const hasDoubleStrike = this.hasKeyword(blocker, Keyword.DOUBLE_STRIKE);

      if (isFirstStrike && !hasFirstStrike && !hasDoubleStrike) continue;
      if (!isFirstStrike && hasFirstStrike && !hasDoubleStrike && state.combat.firstStrikeDamageDealt) continue;

      assignments.push({
        sourceId: blockerId,
        targetId: attackerId,
        amount: power,
      });
    }

    // Apply damage
    for (const assignment of assignments) {
      this.applyDamage(state, assignment);
    }

    state.combat.damageAssignments.push(...assignments);
    if (isFirstStrike) {
      state.combat.firstStrikeDamageDealt = true;
    }
  }

  /** End combat — clear combat state */
  endCombat(state: GameState): void {
    state.combat = null;
  }

  /** Check if a creature can attack */
  canAttack(card: CardInstance, state: GameState): boolean {
    if (card.zone !== 'BATTLEFIELD') return false;
    if (!card.definition.types.includes(CardType.CREATURE)) return false;
    if (card.tapped) return false;
    if (card.controller !== state.activePlayer) return false;
    if (this.hasKeyword(card, Keyword.DEFENDER)) return false;

    // Summoning sickness: can't attack unless has haste
    if (card.summoningSick && !this.hasKeyword(card, Keyword.HASTE)) return false;

    return true;
  }

  /** Check if a creature can block an attacker */
  canBlock(blocker: CardInstance, attacker: CardInstance): boolean {
    if (blocker.zone !== 'BATTLEFIELD') return false;
    if (!blocker.definition.types.includes(CardType.CREATURE)) return false;
    if (blocker.tapped) return false;

    // Flying: can only be blocked by creatures with flying or reach
    if (this.hasKeyword(attacker, Keyword.FLYING)) {
      if (!this.hasKeyword(blocker, Keyword.FLYING) && !this.hasKeyword(blocker, Keyword.REACH)) {
        return false;
      }
    }

    // Menace: must be blocked by two or more creatures
    // (This is checked after all blockers are declared)

    return true;
  }

  /** Get all creatures that can currently attack */
  getValidAttackers(state: GameState): CardInstance[] {
    const battlefield = state.zones[state.activePlayer].BATTLEFIELD;
    return battlefield.filter(c => this.canAttack(c, state));
  }

  private applyDamage(state: GameState, assignment: DamageAssignment): void {
    const source = findCard(state, assignment.sourceId);
    const targetId = assignment.targetId;
    const isCommanderDamage = source ? this.isCommander(source, state) : false;

    if (typeof targetId === 'string' && targetId.startsWith('player')) {
      // Damage to player
      const player = state.players[targetId as PlayerId];
      if (!player || player.hasLost) return;

      player.life -= assignment.amount;

      // Track commander damage
      if (isCommanderDamage && source) {
        if (!player.commanderDamageReceived[source.objectId]) {
          player.commanderDamageReceived[source.objectId] = 0;
        }
        player.commanderDamageReceived[source.objectId] += assignment.amount;
      }

      // Lifelink
      if (source && this.hasKeyword(source, Keyword.LIFELINK)) {
        state.players[source.controller].life += assignment.amount;
        const lifeEvent: GameEvent = {
          type: GameEventType.LIFE_GAINED,
          timestamp: getNextTimestamp(state),
          player: source.controller,
          amount: assignment.amount,
        };
        state.eventLog.push(lifeEvent);
        this.eventBus.emit(lifeEvent);
      }

      const event: GameEvent = {
        type: GameEventType.DAMAGE_DEALT,
        timestamp: getNextTimestamp(state),
        sourceId: assignment.sourceId,
        targetId,
        amount: assignment.amount,
        isCombatDamage: true,
        isCommanderDamage,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);
    } else {
      // Damage to creature/planeswalker
      const target = findCard(state, targetId);
      if (!target || target.zone !== 'BATTLEFIELD') return;

      if (target.definition.types.includes(CardType.PLANESWALKER)) {
        // Damage to planeswalker removes loyalty counters
        target.counters['loyalty'] = (target.counters['loyalty'] ?? 0) - assignment.amount;
      } else {
        target.markedDamage += assignment.amount;
      }

      // Lifelink
      if (source && this.hasKeyword(source, Keyword.LIFELINK)) {
        state.players[source.controller].life += assignment.amount;
      }

      // Deathtouch
      if (source && this.hasKeyword(source, Keyword.DEATHTOUCH)) {
        // Any damage from deathtouch source is lethal — SBAs will handle destruction
      }

      const event: GameEvent = {
        type: GameEventType.DAMAGE_DEALT,
        timestamp: getNextTimestamp(state),
        sourceId: assignment.sourceId,
        targetId,
        amount: assignment.amount,
        isCombatDamage: true,
        isCommanderDamage: false,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);

      const triggers = this.eventBus.checkTriggers(event, state);
      for (const t of triggers) {
        state.pendingTriggers.push(t);
      }
    }
  }

  private isCommander(card: CardInstance, state: GameState): boolean {
    const player = state.players[card.owner];
    return player.commanderIds.includes(card.objectId);
  }

  private hasKeyword(card: CardInstance, keyword: Keyword): boolean {
    if (card.modifiedKeywords) return card.modifiedKeywords.includes(keyword);
    return card.definition.keywords.includes(keyword);
  }
}
