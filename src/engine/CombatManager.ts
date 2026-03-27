import type {
  GameState, PlayerId, ObjectId, CardInstance, DamageAssignment, GameEvent,
  ProtectionFrom,
  AttackTarget,
  ManaCost,
} from './types';
import { CardType, Keyword, GameEventType } from './types';
import { findCard, hasSubtype, hasType, getNextTimestamp } from './GameState';
import type { EventBus } from './EventBus';
import type { ZoneManager } from './ZoneManager';
import type { ManaManager } from './ManaManager';

export class CombatManager {
  private eventBus: EventBus;
  private zoneManager: ZoneManager;
  private manaManager: ManaManager;

  constructor(eventBus: EventBus, zoneManager: ZoneManager, manaManager: ManaManager) {
    this.eventBus = eventBus;
    this.zoneManager = zoneManager;
    this.manaManager = manaManager;
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
    declarations: Array<{ attackerId: ObjectId; defendingPlayer?: PlayerId; defender?: AttackTarget }>,
    taxesPaid = false,
  ): boolean {
    if (!state.combat) return false;

    const normalized = declarations.map((decl) => ({
      attackerId: decl.attackerId,
      defender: decl.defender ?? (decl.defendingPlayer ? { type: 'player' as const, id: decl.defendingPlayer } : null),
    }));

    if (!this.areRequiredAttackersDeclared(state, normalized, taxesPaid)) {
      return false;
    }

    for (const decl of normalized) {
      const card = findCard(state, decl.attackerId);
      if (!card) continue;
      if (!decl.defender) continue;
      if (!this.canAttack(card, state, decl.defender, taxesPaid)) continue;

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
        type: decl.defender.type,
        id: decl.defender.id,
      });

      const event: GameEvent = {
        type: GameEventType.ATTACKS,
        timestamp: getNextTimestamp(state),
        attackerId: card.objectId,
        defendingPlayer: decl.defender.type === 'player' ? decl.defender.id as PlayerId : undefined,
        defender: decl.defender,
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
      if (!this.canBlock(blocker, attacker, state)) continue;

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

    // Enforce menace: if attacker has menace, it must be blocked by 2+ creatures.
    // Remove illegal blocking assignments where a menace creature has only 1 blocker.
    for (const [attackerId] of state.combat.attackers) {
      const attacker = findCard(state, attackerId);
      if (!attacker || !this.hasKeyword(attacker, Keyword.MENACE)) continue;

      const blockersForThis: ObjectId[] = [];
      for (const [blockerId, blockedAttackerId] of state.combat.blockers) {
        if (blockedAttackerId === attackerId) {
          blockersForThis.push(blockerId);
        }
      }
      if (blockersForThis.length === 1) {
        // Illegal — menace requires 2+ blockers; remove the single blocker assignment
        state.combat.blockers.delete(blockersForThis[0]);
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

  /** Remove an eliminated player and all related combat objects from the current combat */
  removePlayerFromCombat(state: GameState, playerId: PlayerId): void {
    if (!state.combat) return;

    const removedAttackers = new Set<ObjectId>();

    for (const [attackerId, target] of [...state.combat.attackers.entries()]) {
      const attacker = findCard(state, attackerId);
      const attackerGone = !attacker || attacker.zone !== 'BATTLEFIELD';
      const removeForController = attacker?.controller === playerId || attacker?.owner === playerId;
      const removeForTarget = target.type === 'player' && target.id === playerId;
      if (attackerGone || removeForController || removeForTarget) {
        state.combat.attackers.delete(attackerId);
        state.combat.blockerOrder.delete(attackerId);
        removedAttackers.add(attackerId);
      }
    }

    for (const [blockerId, attackerId] of [...state.combat.blockers.entries()]) {
      const blocker = findCard(state, blockerId);
      const blockerGone = !blocker || blocker.zone !== 'BATTLEFIELD';
      const removeForController = blocker?.controller === playerId || blocker?.owner === playerId;
      if (blockerGone || removeForController || removedAttackers.has(attackerId)) {
        state.combat.blockers.delete(blockerId);
      }
    }

    state.combat.damageAssignments = state.combat.damageAssignments.filter((assignment) => {
      if (typeof assignment.targetId === 'string' && assignment.targetId === playerId) {
        return false;
      }

      const source = findCard(state, assignment.sourceId);
      if (source && (source.owner === playerId || source.controller === playerId)) {
        return false;
      }

      if (typeof assignment.targetId !== 'string') {
        const target = findCard(state, assignment.targetId);
        if (target && (target.owner === playerId || target.controller === playerId)) {
          return false;
        }
      }

      return true;
    });

    if (state.combat.attackers.size === 0) {
      state.combat = null;
    }
  }

  /** Check if a creature can attack */
  canAttack(card: CardInstance, state: GameState, defender?: AttackTarget, taxesPaid = false): boolean {
    if (card.zone !== 'BATTLEFIELD') return false;
    if (card.phasedOut) return false;
    if (!hasType(card, CardType.CREATURE)) return false;
    if (card.tapped) return false;
    if (card.controller !== state.activePlayer) return false;
    if (this.hasKeyword(card, Keyword.DEFENDER)) return false;

    // Summoning sickness: can't attack unless has haste
    if (card.summoningSick && !this.hasKeyword(card, Keyword.HASTE)) return false;

    const legalTargets = this.getLegalAttackTargets(card, state, taxesPaid);
    if (legalTargets.length === 0) return false;
    if (defender) {
      return legalTargets.some((candidate) => this.targetsEqual(candidate, defender));
    }

    return true;
  }

  /** Check if a creature can block an attacker */
  canBlock(blocker: CardInstance, attacker: CardInstance, state?: GameState): boolean {
    if (blocker.zone !== 'BATTLEFIELD') return false;
    if (blocker.phasedOut || attacker.phasedOut) return false;
    if (!hasType(blocker, CardType.CREATURE)) return false;
    if (blocker.tapped) return false;

    // Unblockable: creature with this keyword can't be blocked
    if (this.hasKeyword(attacker, Keyword.UNBLOCKABLE)) return false;

    // Flying: can only be blocked by creatures with flying or reach
    if (this.hasKeyword(attacker, Keyword.FLYING)) {
      if (!this.hasKeyword(blocker, Keyword.FLYING) && !this.hasKeyword(blocker, Keyword.REACH)) {
        return false;
      }
    }

    // Landwalk: if attacker has a landwalk keyword and defending player controls that land type,
    // the attacker can't be blocked
    if (state) {
      const defendingPlayer = blocker.controller;
      if (this.hasLandwalkEvasion(attacker, defendingPlayer, state)) {
        return false;
      }
    }

    // Protection: attacker with protection from a quality the blocker possesses can't be blocked
    if (this.hasProtectionFrom(attacker, blocker)) return false;

    return true;
  }

  /** Get all creatures that can currently attack */
  getValidAttackers(state: GameState, taxesPaid = false): CardInstance[] {
    const battlefield = state.zones[state.activePlayer].BATTLEFIELD;
    return battlefield.filter(c => this.canAttack(c, state, undefined, taxesPaid));
  }

  getLegalAttackTargets(card: CardInstance, state: GameState, taxesPaid = false): AttackTarget[] {
    if (!this.canAttackBase(card, state)) {
      return [];
    }

    const possibleTargets = this.getAllPossibleAttackTargets(card, state, taxesPaid);
    if (possibleTargets.length === 0) {
      return [];
    }

    const goadingPlayers = this.getGoadingPlayers(card);
    const nonGoadingTargets = possibleTargets.filter((target) => !this.isTargetControlledByAny(target, goadingPlayers, state));

    if (goadingPlayers.length > 0 && nonGoadingTargets.length > 0) {
      return nonGoadingTargets;
    }

    return possibleTargets;
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

      // Monarch transfer: when combat damage is dealt to the monarch,
      // the attacking player's controller becomes the new monarch
      if (state.monarch === (targetId as PlayerId) && source) {
        state.monarch = source.controller;
      }
    } else {
      // Damage to creature/planeswalker
      const target = findCard(state, targetId);
      if (!target || target.zone !== 'BATTLEFIELD') return;

      if (hasType(target, CardType.PLANESWALKER)) {
        // Damage to planeswalker removes loyalty counters
        target.counters['loyalty'] = (target.counters['loyalty'] ?? 0) - assignment.amount;
      } else {
        target.markedDamage += assignment.amount;
        if (source && this.hasKeyword(source, Keyword.DEATHTOUCH) && assignment.amount > 0) {
          target.counters['deathtouch-damage'] = 1;
        }
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
    return player.commanderIds.includes(card.cardId);
  }

  private hasKeyword(card: CardInstance, keyword: Keyword): boolean {
    if (card.modifiedKeywords) return card.modifiedKeywords.includes(keyword);
    return card.definition.keywords.includes(keyword);
  }

  /** Get all protection-from entries for a card (computed or definition) */
  private getProtection(card: CardInstance): ProtectionFrom[] {
    return card.protectionFrom ?? card.definition.protectionFrom ?? [];
  }

  /**
   * Check if `protectedCard` has protection from a quality that `source` possesses.
   * Protection prevents: Damage, Enchanting/Equipping, Blocking, Targeting (DEBT).
   * For blocking: the attacker's protection is checked against blocker qualities.
   */
  private hasProtectionFrom(protectedCard: CardInstance, source: CardInstance): boolean {
    const protections = this.getProtection(protectedCard);
    if (protections.length === 0) return false;

    for (const prot of protections) {
      // Check color protection: source's color identity matches a protected color
      if (prot.colors && prot.colors.length > 0) {
        if (prot.colors.some(c => source.definition.colorIdentity.includes(c))) {
          return true;
        }
      }
      // Check type protection: source's types match a protected type
      if (prot.types && prot.types.length > 0) {
        if (prot.types.some(t => hasType(source, t))) {
          return true;
        }
      }
      // Check custom protection
      if (prot.custom && prot.custom(source)) {
        return true;
      }
    }

    return false;
  }

  /** Landwalk map: keyword -> basic land subtype */
  private static readonly LANDWALK_MAP: Record<string, string> = {
    'Plainswalk': 'Plains',
    'Islandwalk': 'Island',
    'Swampwalk': 'Swamp',
    'Mountainwalk': 'Mountain',
    'Forestwalk': 'Forest',
  };

  /**
   * Check if attacker has a landwalk keyword and the defending player controls
   * a land with the corresponding basic land subtype.
   */
  private hasLandwalkEvasion(
    attacker: CardInstance,
    defendingPlayer: PlayerId,
    state: GameState
  ): boolean {
    const keywords = attacker.modifiedKeywords ?? attacker.definition.keywords;
    const defenderBattlefield = state.zones[defendingPlayer].BATTLEFIELD;

    for (const [walkKeyword, landSubtype] of Object.entries(CombatManager.LANDWALK_MAP)) {
      if (keywords.includes(walkKeyword as Keyword)) {
        // Check if defending player controls a land with that subtype
        const hasMatchingLand = defenderBattlefield.some(card =>
          hasType(card, CardType.LAND) &&
          hasSubtype(card, landSubtype)
        );
        if (hasMatchingLand) return true;
      }
    }

    return false;
  }

  private canAttackBase(card: CardInstance, state: GameState): boolean {
    if (card.zone !== 'BATTLEFIELD') return false;
    if (card.phasedOut) return false;
    if (!hasType(card, CardType.CREATURE)) return false;
    if (card.tapped) return false;
    if (card.controller !== state.activePlayer) return false;
    if (this.hasKeyword(card, Keyword.DEFENDER)) return false;
    if (card.summoningSick && !this.hasKeyword(card, Keyword.HASTE)) return false;
    return true;
  }

  private getAllPossibleAttackTargets(card: CardInstance, state: GameState, taxesPaid = false): AttackTarget[] {
    const attackTargets: AttackTarget[] = [];

    for (const playerId of state.turnOrder) {
      if (playerId === card.controller) continue;
      if (state.players[playerId].hasLost) continue;

      const playerTarget: AttackTarget = { type: 'player', id: playerId };
      if (this.canAttackTarget(card, playerTarget, state) && (taxesPaid || this.canCurrentlyAffordAttackTarget(card, playerTarget, state))) {
        attackTargets.push(playerTarget);
      }

      for (const permanent of state.zones[playerId].BATTLEFIELD) {
        if (!hasType(permanent, CardType.PLANESWALKER)) continue;
        if (permanent.phasedOut) continue;

        const planeswalkerTarget: AttackTarget = { type: 'planeswalker', id: permanent.objectId };
        if (this.canAttackTarget(card, planeswalkerTarget, state) && (taxesPaid || this.canCurrentlyAffordAttackTarget(card, planeswalkerTarget, state))) {
          attackTargets.push(planeswalkerTarget);
        }
      }
    }

    return attackTargets;
  }

  private canAttackTarget(card: CardInstance, target: AttackTarget, state: GameState): boolean {
    const defendingPlayer = this.getDefendingPlayer(target, state);
    if (!defendingPlayer) return false;
    if (state.players[defendingPlayer].hasLost) return false;

    return true;
  }

  private areRequiredAttackersDeclared(
    state: GameState,
    declarations: Array<{ attackerId: ObjectId; defender: AttackTarget | null }>,
    taxesPaid = false,
  ): boolean {
    const declaredIds = new Set(declarations.map((declaration) => declaration.attackerId));

    for (const attacker of this.getValidAttackers(state, taxesPaid)) {
      if (!this.mustAttackIfAble(attacker)) continue;
      if (declaredIds.has(attacker.objectId)) continue;
      if (this.getLegalAttackTargets(attacker, state, taxesPaid).length > 0) {
        return false;
      }
    }

    return true;
  }

  private mustAttackIfAble(card: CardInstance): boolean {
    return this.getGoadingPlayers(card).length > 0;
  }

  private getGoadingPlayers(card: CardInstance): PlayerId[] {
    return Object.keys(card.counters)
      .filter((counterName) => counterName.startsWith('goaded-by-') && (card.counters[counterName] ?? 0) > 0)
      .map((counterName) => counterName.replace('goaded-by-', '') as PlayerId);
  }

  private getDefendingPlayer(target: AttackTarget, state: GameState): PlayerId | null {
    if (target.type === 'player') {
      return target.id as PlayerId;
    }

    const planeswalker = findCard(state, target.id as ObjectId);
    if (!planeswalker || planeswalker.zone !== 'BATTLEFIELD') return null;
    return planeswalker.controller;
  }

  private isTargetControlledByAny(target: AttackTarget, players: PlayerId[], state: GameState): boolean {
    const defendingPlayer = this.getDefendingPlayer(target, state);
    return defendingPlayer ? players.includes(defendingPlayer) : false;
  }

  private targetsEqual(left: AttackTarget, right: AttackTarget): boolean {
    return left.type === right.type && left.id === right.id;
  }

  private canCurrentlyAffordAttackTarget(card: CardInstance, target: AttackTarget, state: GameState): boolean {
    const defendingPlayer = this.getDefendingPlayer(target, state);
    if (!defendingPlayer) return false;
    const taxCost = this.getAttackTaxCostForDefender(card, defendingPlayer);
    if (
      taxCost.generic === 0 &&
      taxCost.W === 0 &&
      taxCost.U === 0 &&
      taxCost.B === 0 &&
      taxCost.R === 0 &&
      taxCost.G === 0 &&
      taxCost.C === 0 &&
      (taxCost.hybrid?.length ?? 0) === 0 &&
      (taxCost.phyrexian?.length ?? 0) === 0
    ) {
      return true;
    }

    const battlefield = state.zones[card.controller].BATTLEFIELD.filter((permanent) => !permanent.phasedOut);
    return this.manaManager.autoTapForCost(state, card.controller, taxCost, battlefield) != null;
  }

  private getAttackTaxCostForDefender(card: CardInstance, defendingPlayer: PlayerId): ManaCost {
    const total: ManaCost = { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 };
    for (const tax of card.attackTaxes ?? []) {
      if (tax.defender !== defendingPlayer || !tax.cost.mana) continue;
      total.generic += tax.cost.mana.generic;
      total.W += tax.cost.mana.W;
      total.U += tax.cost.mana.U;
      total.B += tax.cost.mana.B;
      total.R += tax.cost.mana.R;
      total.G += tax.cost.mana.G;
      total.C += tax.cost.mana.C;
      total.X += tax.cost.mana.X;
      if (tax.cost.mana.hybrid?.length) {
        total.hybrid = [...(total.hybrid ?? []), ...tax.cost.mana.hybrid];
      }
      if (tax.cost.mana.phyrexian?.length) {
        total.phyrexian = [...(total.phyrexian ?? []), ...tax.cost.mana.phyrexian];
      }
    }
    return total;
  }
}
