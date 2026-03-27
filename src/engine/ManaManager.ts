import type {
  CardInstance,
  GameEvent,
  GameState,
  ManaColor,
  ManaCost,
  ManaPool,
  ManaProduction,
  ManaSymbol,
  PlayerId,
} from './types';
import { GameEventType, Keyword, emptyManaPool } from './types';
import { getNextTimestamp } from './GameState';
import type { EventBus } from './EventBus';

export interface AutoTapPlanEntry {
  sourceId: string;
  color: ManaSymbol;
  amount: number;
  tap: boolean;
  sacrificeSelf: boolean;
}

interface PaymentResult {
  pool: ManaPool;
  life: number;
}

interface ManaSource {
  sourceId: string;
  options: AutoTapPlanEntry[];
}

export class ManaManager {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  addMana(state: GameState, player: PlayerId, color: keyof ManaPool, amount: number): void {
    const actualColor = this.normalizeProducedColor(state, player, color);
    state.players[player].manaPool[actualColor] += amount;

    const event: GameEvent = {
      type: GameEventType.MANA_PRODUCED,
      timestamp: getNextTimestamp(state),
      player,
      color: actualColor,
      amount,
    };
    state.eventLog.push(event);
    this.eventBus.emit(event);
  }

  canPayMana(state: GameState, player: PlayerId, cost: ManaCost): boolean {
    return this.solvePaymentFromPool(state.players[player].manaPool, cost, state.players[player].life) !== null;
  }

  payMana(state: GameState, player: PlayerId, cost: ManaCost): boolean {
    const result = this.solvePaymentFromPool(state.players[player].manaPool, cost, state.players[player].life);
    if (!result) {
      return false;
    }

    const lifeLost = state.players[player].life - result.life;
    state.players[player].manaPool = result.pool;
    state.players[player].life = result.life;

    if (lifeLost > 0) {
      const event: GameEvent = {
        type: GameEventType.LIFE_LOST,
        timestamp: getNextTimestamp(state),
        player,
        amount: lifeLost,
      };
      state.eventLog.push(event);
      this.eventBus.emit(event);
    }

    return true;
  }

  emptyPool(state: GameState, player: PlayerId): void {
    state.players[player].manaPool = emptyManaPool();
  }

  emptyAllPools(state: GameState): void {
    for (const pid of state.turnOrder) {
      this.emptyPool(state, pid);
    }
  }

  totalAvailable(state: GameState, player: PlayerId): number {
    const pool = state.players[player].manaPool;
    return pool.W + pool.U + pool.B + pool.R + pool.G + pool.C;
  }

  canAffordWithManaProduction(
    state: GameState,
    player: PlayerId,
    cost: ManaCost,
  ): boolean {
    const effectiveCost: ManaCost = cost.X > 0 ? { ...cost, X: 0 } : cost;
    const sources = this.getManaSources(state, player, state.zones[player].BATTLEFIELD);
    return this.findSourcePaymentPlan(
      { ...state.players[player].manaPool },
      effectiveCost,
      state.players[player].life,
      sources,
    ) !== null;
  }

  autoTapForCost(
    state: GameState,
    player: PlayerId,
    cost: ManaCost,
    battlefield: CardInstance[],
  ): AutoTapPlanEntry[] | null {
    const sources = this.getManaSources(state, player, battlefield);
    const plan = this.findSourcePaymentPlan(
      { ...state.players[player].manaPool },
      cost,
      state.players[player].life,
      sources,
    );

    return plan?.plan ?? null;
  }

  private normalizeProducedColor(state: GameState, player: PlayerId, color: ManaSymbol): ManaSymbol {
    if (color === 'C') {
      return 'C';
    }
    return state.players[player].colorIdentity.includes(color as ManaColor) ? color : 'C';
  }

  private getManaSources(state: GameState, player: PlayerId, battlefield: CardInstance[]): ManaSource[] {
    return battlefield
      .filter(card => card.controller === player && !card.tapped)
      .flatMap((card) => {
        const ability = card.definition.abilities.find(candidate => candidate.kind === 'activated' && candidate.isManaAbility);
        if (!ability || ability.kind !== 'activated') {
          return [];
        }
        if (!this.canActivateManaAbility(card, ability)) {
          return [];
        }

        const productions = this.getManaProductions(card, ability, state.players[player].colorIdentity);
        if (productions.length === 0) {
          return [];
        }

        return [{
          sourceId: card.objectId,
          options: productions.flatMap((production) => {
            const colors = this.normalizeProductionColors(production, state.players[player].colorIdentity);
            return colors.map(color => ({
              sourceId: card.objectId,
              color,
              amount: production.amount,
              tap: Boolean(ability.cost.tap),
              sacrificeSelf: Boolean(ability.cost.sacrifice?.self),
            }));
          }),
        }];
      });
  }

  private canActivateManaAbility(card: CardInstance, ability: { cost: { tap?: boolean } }): boolean {
    if (!ability.cost.tap) {
      return true;
    }
    if (!card.definition.types.includes('Creature' as import('./types').CardType)) {
      return true;
    }
    if (!card.summoningSick) {
      return true;
    }
    return card.definition.keywords.includes(Keyword.HASTE);
  }

  private getManaProductions(
    card: CardInstance,
    ability: { manaProduction?: ManaProduction[]; description: string },
    colorIdentity: ManaColor[],
  ): ManaProduction[] {
    if (ability.manaProduction && ability.manaProduction.length > 0) {
      return ability.manaProduction;
    }

    const subtypes = card.definition.subtypes;
    if (subtypes.includes('Plains')) return [{ amount: 1, colors: ['W'] }];
    if (subtypes.includes('Island')) return [{ amount: 1, colors: ['U'] }];
    if (subtypes.includes('Swamp')) return [{ amount: 1, colors: ['B'] }];
    if (subtypes.includes('Mountain')) return [{ amount: 1, colors: ['R'] }];
    if (subtypes.includes('Forest')) return [{ amount: 1, colors: ['G'] }];

    const lower = ability.description.toLowerCase();
    if (lower.includes('commander') && lower.includes('any color')) {
      const colors = colorIdentity.length > 0 ? colorIdentity : ['C'];
      return [{ amount: 1, colors: colors as ManaSymbol[], restrictToColorIdentity: true }];
    }
    if (lower.includes('any color')) {
      return [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }];
    }

    const parsed: ManaProduction[] = [];
    for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
      const matches = ability.description.match(new RegExp(`\\{${color}\\}`, 'g'));
      if (matches) {
        parsed.push({ amount: matches.length, colors: [color] });
      }
    }

    return parsed.length > 0 ? parsed : [{ amount: 1, colors: ['C'] }];
  }

  private normalizeProductionColors(production: ManaProduction, colorIdentity: ManaColor[]): ManaSymbol[] {
    if (production.restrictToColorIdentity) {
      return colorIdentity.length > 0 ? [...new Set(colorIdentity as ManaSymbol[])] : ['C'];
    }

    const colors = [...new Set(production.colors)];
    const hasColoredOption = colors.some(color => color !== 'C');
    if (!hasColoredOption) {
      return colors;
    }

    const normalized = new Set<ManaSymbol>();
    for (const color of colors) {
      if (color === 'C' || colorIdentity.includes(color as ManaColor)) {
        normalized.add(color);
      }
    }
    if (normalized.size === 0) {
      normalized.add('C');
    }
    return [...normalized];
  }

  private findSourcePaymentPlan(
    pool: ManaPool,
    cost: ManaCost,
    life: number,
    sources: ManaSource[],
    index = 0,
    plan: AutoTapPlanEntry[] = [],
  ): { plan: AutoTapPlanEntry[]; result: PaymentResult } | null {
    const directPayment = this.solvePaymentFromPool(pool, cost, life);
    if (directPayment) {
      return {
        plan: [...plan],
        result: directPayment,
      };
    }

    if (index >= sources.length) {
      return null;
    }

    const source = sources[index];

    const skipped = this.findSourcePaymentPlan(pool, cost, life, sources, index + 1, plan);
    if (skipped) {
      return skipped;
    }

    for (const option of source.options) {
      const nextPool = { ...pool };
      nextPool[option.color] += option.amount;
      plan.push(option);
      const result = this.findSourcePaymentPlan(nextPool, cost, life, sources, index + 1, plan);
      if (result) {
        return result;
      }
      plan.pop();
    }

    return null;
  }

  private solvePaymentFromPool(pool: ManaPool, cost: ManaCost, life: number): PaymentResult | null {
    const nextPool = { ...pool };

    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      if (nextPool[color] < cost[color]) {
        return null;
      }
      nextPool[color] -= cost[color];
    }

    if (nextPool.C < cost.C) {
      return null;
    }
    nextPool.C -= cost.C;

    return this.resolveSpecialSymbols(
      nextPool,
      cost.generic,
      [...(cost.hybrid ?? [])],
      [...(cost.phyrexian ?? [])],
      life,
    );
  }

  private resolveSpecialSymbols(
    pool: ManaPool,
    generic: number,
    hybrid: string[],
    phyrexian: ManaColor[],
    life: number,
  ): PaymentResult | null {
    if (hybrid.length > 0) {
      const [symbol, ...rest] = hybrid;
      for (const candidate of this.getHybridPaymentCandidates(symbol, pool)) {
        const result = this.resolveSpecialSymbols(candidate, generic, rest, phyrexian, life);
        if (result) {
          return result;
        }
      }
      return null;
    }

    if (phyrexian.length > 0) {
      const [color, ...rest] = phyrexian;
      const manaPaid = this.trySpendColored(pool, color);
      if (manaPaid) {
        const result = this.resolveSpecialSymbols(manaPaid, generic, hybrid, rest, life);
        if (result) {
          return result;
        }
      }
      if (life >= 2) {
        const result = this.resolveSpecialSymbols(pool, generic, hybrid, rest, life - 2);
        if (result) {
          return result;
        }
      }
      return null;
    }

    const genericPaid = this.trySpendGeneric(pool, generic);
    if (!genericPaid) {
      return null;
    }

    return {
      pool: genericPaid,
      life,
    };
  }

  private getHybridPaymentCandidates(symbol: string, pool: ManaPool): ManaPool[] {
    if (symbol.startsWith('2/')) {
      const color = symbol.split('/')[1] as ManaColor;
      const candidates: ManaPool[] = [];
      const colored = this.trySpendColored(pool, color);
      if (colored) {
        candidates.push(colored);
      }
      const generic = this.trySpendGeneric(pool, 2);
      if (generic) {
        candidates.push(generic);
      }
      return candidates;
    }

    const colors = symbol.split('/').filter((part): part is ManaColor =>
      part === 'W' || part === 'U' || part === 'B' || part === 'R' || part === 'G'
    );
    return colors
      .map(color => this.trySpendColored(pool, color))
      .filter((candidate): candidate is ManaPool => candidate !== null);
  }

  private trySpendColored(pool: ManaPool, color: ManaColor): ManaPool | null {
    if (pool[color] <= 0) {
      return null;
    }
    const next = { ...pool };
    next[color] -= 1;
    return next;
  }

  private trySpendGeneric(pool: ManaPool, amount: number): ManaPool | null {
    const next = { ...pool };
    let remaining = amount;
    for (const color of ['C', 'W', 'U', 'B', 'R', 'G'] as const) {
      const paid = Math.min(next[color], remaining);
      next[color] -= paid;
      remaining -= paid;
      if (remaining === 0) {
        return next;
      }
    }
    return remaining === 0 ? next : null;
  }
}
