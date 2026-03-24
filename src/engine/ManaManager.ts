import type { GameState, PlayerId, ManaCost, ManaPool, GameEvent } from './types';
import { GameEventType, emptyManaPool } from './types';
import { getNextTimestamp } from './GameState';
import type { EventBus } from './EventBus';

export class ManaManager {
  constructor(private eventBus: EventBus) {}

  addMana(state: GameState, player: PlayerId, color: keyof ManaPool, amount: number): void {
    state.players[player].manaPool[color] += amount;

    const event: GameEvent = {
      type: GameEventType.MANA_PRODUCED,
      timestamp: getNextTimestamp(state),
      player,
      color,
      amount,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  canPayMana(state: GameState, player: PlayerId, cost: ManaCost): boolean {
    const pool = { ...state.players[player].manaPool };
    return this.tryPay(pool, cost);
  }

  payMana(state: GameState, player: PlayerId, cost: ManaCost): boolean {
    const pool = state.players[player].manaPool;
    const poolCopy = { ...pool };

    if (!this.tryPay(poolCopy, cost)) {
      return false;
    }

    // Apply the payment
    Object.assign(pool, poolCopy);
    return true;
  }

  /** Empty mana pool (called at phase/step transitions) */
  emptyPool(state: GameState, player: PlayerId): void {
    state.players[player].manaPool = emptyManaPool();
  }

  emptyAllPools(state: GameState): void {
    for (const pid of state.turnOrder) {
      this.emptyPool(state, pid);
    }
  }

  /** Get total available mana for a player (pool only) */
  totalAvailable(state: GameState, player: PlayerId): number {
    const pool = state.players[player].manaPool;
    return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
  }

  /**
   * Check if a player could afford a cost by considering both their current
   * mana pool AND untapped mana sources (lands, mana dorks, artifacts).
   * This is used for determining legal actions before tapping.
   *
   * Sources that produce "any color" are tracked separately and used flexibly
   * to fill whatever colored requirement remains after fixed-color sources.
   */
  canAffordWithManaProduction(
    state: GameState,
    player: PlayerId,
    cost: ManaCost
  ): boolean {
    // Start with what's already in the pool
    const available: ManaPool = { ...state.players[player].manaPool };
    let flexibleSources = 0; // sources that can produce any color (Command Tower, Birds, etc.)

    // Find all untapped permanents with mana abilities
    const battlefield = state.zones[player].BATTLEFIELD;
    for (const card of battlefield) {
      if (card.tapped) continue;
      if (card.controller !== player) continue;

      for (const ability of card.definition.abilities) {
        if (ability.kind !== 'activated' || !ability.isManaAbility) continue;
        // Skip if summoning sick and requires tap (unless has haste)
        if (ability.cost.tap && card.summoningSick &&
            !card.definition.keywords.includes('Haste' as import('./types').Keyword)) continue;

        const production = this.classifyManaProduction(card, ability.description);
        if (production.type === 'fixed') {
          for (const color of Object.keys(production.mana) as (keyof ManaPool)[]) {
            available[color] += production.mana[color];
          }
        } else {
          // "any color" — track as flexible
          flexibleSources += production.count;
        }
        break; // Only count one mana ability per permanent
      }
    }

    return this.tryPayWithFlex(available, flexibleSources, cost);
  }

  /**
   * Classify what a mana source produces: either fixed colors or "any color".
   */
  private classifyManaProduction(
    card: import('./types').CardInstance,
    description: string
  ): { type: 'fixed'; mana: ManaPool } | { type: 'flexible'; count: number } {
    const subtypes = card.definition.subtypes;

    // "Any color" sources — these are flexible
    if (description.toLowerCase().includes('any color')) {
      return { type: 'flexible', count: 1 };
    }

    const mana: ManaPool = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

    // Check basic land types
    if (subtypes.includes('Plains')) { mana.W++; return { type: 'fixed', mana }; }
    if (subtypes.includes('Island')) { mana.U++; return { type: 'fixed', mana }; }
    if (subtypes.includes('Swamp')) { mana.B++; return { type: 'fixed', mana }; }
    if (subtypes.includes('Mountain')) { mana.R++; return { type: 'fixed', mana }; }
    if (subtypes.includes('Forest')) { mana.G++; return { type: 'fixed', mana }; }

    // Count specific mana symbols in description
    const colorMatches: (keyof ManaPool)[] = [];
    for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
      const regex = new RegExp(`\\{${color}\\}`, 'g');
      const matches = description.match(regex);
      if (matches) {
        mana[color] += matches.length;
        colorMatches.push(color);
      }
    }
    if (colorMatches.length > 0) return { type: 'fixed', mana };

    // Default: assume 1 colorless
    mana.C++;
    return { type: 'fixed', mana };
  }

  /**
   * Try to pay a mana cost using fixed mana + flexible "any color" sources.
   * Flexible sources fill in whatever colored gaps remain after fixed sources.
   */
  private tryPayWithFlex(pool: ManaPool, flex: number, cost: ManaCost): boolean {
    const p = { ...pool };
    let flexRemaining = flex;

    // Pay colored costs — use fixed first, then flex for shortfalls
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      const needed = cost[color];
      if (needed <= 0) continue;
      const fromPool = Math.min(p[color], needed);
      p[color] -= fromPool;
      const shortfall = needed - fromPool;
      if (shortfall > 0) {
        if (flexRemaining >= shortfall) {
          flexRemaining -= shortfall;
        } else {
          return false; // Can't meet colored requirement
        }
      }
    }

    // Pay colorless-specific cost {C}
    if (cost.C > 0) {
      const fromPool = Math.min(p.C, cost.C);
      p.C -= fromPool;
      const shortfall = cost.C - fromPool;
      if (shortfall > 0) {
        if (flexRemaining >= shortfall) {
          flexRemaining -= shortfall;
        } else {
          return false;
        }
      }
    }

    // Pay generic cost with whatever's left
    let generic = cost.generic;
    if (generic <= 0) return true;

    // Use remaining fixed mana first
    for (const color of ['C', 'W', 'U', 'B', 'R', 'G'] as const) {
      const pay = Math.min(p[color], generic);
      p[color] -= pay;
      generic -= pay;
      if (generic <= 0) return true;
    }

    // Use remaining flex sources for generic
    if (flexRemaining >= generic) return true;

    return false;
  }

  /**
   * Try to pay a mana cost from a pool (mutates the pool copy).
   * Returns true if payment succeeded.
   */
  private tryPay(pool: ManaPool, cost: ManaCost): boolean {
    // Pay colored costs first
    if (cost.W > pool.W) return false;
    pool.W -= cost.W;

    if (cost.U > pool.U) return false;
    pool.U -= cost.U;

    if (cost.B > pool.B) return false;
    pool.B -= cost.B;

    if (cost.R > pool.R) return false;
    pool.R -= cost.R;

    if (cost.G > pool.G) return false;
    pool.G -= cost.G;

    if (cost.C > pool.C) return false;
    pool.C -= cost.C;

    // Pay generic cost with any available mana
    let remaining = cost.generic;
    if (remaining <= 0) return true;

    // Pay generic with each color (prefer colorless first to preserve colored)
    const payOrder: (keyof ManaPool)[] = ['C', 'W', 'U', 'B', 'R', 'G'];
    for (const color of payOrder) {
      const pay = Math.min(pool[color], remaining);
      pool[color] -= pay;
      remaining -= pay;
      if (remaining <= 0) break;
    }

    return remaining <= 0;
  }

  /**
   * Auto-tap lands to produce mana for a given cost.
   * Returns the objectIds of lands that should be tapped,
   * or null if not enough mana can be produced.
   */
  autoTapForCost(
    state: GameState,
    player: PlayerId,
    cost: ManaCost,
    battlefield: import('./types').CardInstance[]
  ): string[] | null {
    // Get all untapped lands/mana sources controlled by this player
    const untappedLands = battlefield.filter(c =>
      c.controller === player &&
      !c.tapped &&
      c.definition.types.includes('Land' as import('./types').CardType)
    );

    // Simple greedy approach: figure out what mana we need
    const needed = { ...cost };
    const toLap: string[] = [];

    // First pass: tap lands that produce the exact colored mana we need
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      while (needed[color] > 0) {
        const land = untappedLands.find(l =>
          !toLap.includes(l.objectId) && this.landProducesColor(l, color)
        );
        if (!land) break;
        toLap.push(land.objectId);
        needed[color]--;
      }
    }

    // Check if we couldn't meet colored requirements
    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      if (needed[color] > 0) return null;
    }

    // Handle colorless-specific cost
    while (needed.C > 0) {
      const land = untappedLands.find(l =>
        !toLap.includes(l.objectId)
      );
      if (!land) return null;
      toLap.push(land.objectId);
      needed.C--;
    }

    // Second pass: tap lands for generic mana
    let genericRemaining = needed.generic;
    while (genericRemaining > 0) {
      const land = untappedLands.find(l =>
        !toLap.includes(l.objectId)
      );
      if (!land) return null;
      toLap.push(land.objectId);
      genericRemaining--;
    }

    return toLap;
  }

  private landProducesColor(card: import('./types').CardInstance, color: string): boolean {
    // Check basic land types
    const subtypes = card.definition.subtypes;
    if (color === 'W' && subtypes.includes('Plains')) return true;
    if (color === 'U' && subtypes.includes('Island')) return true;
    if (color === 'B' && subtypes.includes('Swamp')) return true;
    if (color === 'R' && subtypes.includes('Mountain')) return true;
    if (color === 'G' && subtypes.includes('Forest')) return true;

    // Check activated abilities for mana production
    for (const ability of card.definition.abilities) {
      if (ability.kind === 'activated' && ability.isManaAbility) {
        // Check the ability description for mana color hints
        if (ability.description.includes(`{${color}}`)) return true;
      }
    }

    return false;
  }
}
