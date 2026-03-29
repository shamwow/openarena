import type {
  ActivatedAbilityDef,
  AddManaOptions,
  CardInstance,
  CardDefinition,
  GameEvent,
  GameState,
  ManaColor,
  ManaCost,
  ManaPool,
  ManaProduction,
  ManaSpendRestriction,
  ManaSymbol,
  PlayerId,
  TrackedMana,
  TrackedManaEffect,
} from './types';
import { GameEventType, emptyManaPool } from './types';
import { getEffectiveAbilities, getEffectiveSubtypes, getEffectiveSupertypes, getNextTimestamp, hasType } from './GameState';
import { getActivationRuleProfile } from './AbilityPrimitives';
import type { EventBus } from './EventBus';
import { ActivatedAbility, TriggeredAbility } from './abilities';

export interface AutoTapPlanEntry {
  sourceId: string;
  mana: Partial<ManaPool>;
  plannerMana?: Partial<ManaPool>;
  tap: boolean;
  sacrificeSelf: boolean;
  trackedManaEffect?: TrackedManaEffect;
  manaRestriction?: ManaSpendRestriction;
}

interface PaymentResult {
  pool: ManaPool;
  life: number;
}

export interface PayManaContext {
  spellDefinition?: CardDefinition;
}

export interface PayManaResult {
  spentTrackedMana: TrackedMana[];
  spentMana: ManaPool;
}

interface ManaSource {
  sourceId: string;
  options: AutoTapPlanEntry[];
}

interface ExactManaUnit {
  color: ManaSymbol;
  trackedIndex?: number;
}

interface ExactPaymentResult extends PaymentResult {
  remainingTrackedMana: TrackedMana[];
  spentTrackedMana: TrackedMana[];
}

export class ManaManager {
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  addMana(
    state: GameState,
    player: PlayerId,
    color: keyof ManaPool,
    amount: number,
    options?: AddManaOptions,
  ): void {
    const actualColor = this.normalizeProducedColor(state, player, color);
    state.players[player].manaPool[actualColor] += amount;
    if (options?.trackedMana) {
      for (let i = 0; i < amount; i += 1) {
        state.players[player].trackedMana.push({
          color: actualColor,
          ...options.trackedMana,
        });
      }
    }

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
    return this.solvePaymentWithTrackedMana(
      state.players[player].manaPool,
      state.players[player].trackedMana,
      cost,
      state.players[player].life,
    ) !== null || this.solvePaymentFromPool(state.players[player].manaPool, cost, state.players[player].life) !== null;
  }

  payMana(state: GameState, player: PlayerId, cost: ManaCost): boolean {
    return this.payManaWithContext(state, player, cost) !== null;
  }

  payManaWithContext(
    state: GameState,
    player: PlayerId,
    cost: ManaCost,
    context?: PayManaContext,
  ): PayManaResult | null {
    const exactResult = this.solvePaymentWithTrackedMana(
      state.players[player].manaPool,
      state.players[player].trackedMana,
      cost,
      state.players[player].life,
      context,
    );
    const simpleResult = exactResult
      ? null
      : this.solvePaymentFromPool(state.players[player].manaPool, cost, state.players[player].life);

    if (!exactResult && !simpleResult) {
      return null;
    }

    const poolAfterPayment = exactResult?.pool ?? simpleResult!.pool;
    const lifeAfterPayment = exactResult?.life ?? simpleResult!.life;
    const spentMana = this.diffManaPools(state.players[player].manaPool, poolAfterPayment);
    const lifeLost = state.players[player].life - lifeAfterPayment;
    const spentTrackedMana = exactResult?.spentTrackedMana
      ?? this.consumeTrackedMana(state, player, spentMana, context);
    state.players[player].manaPool = poolAfterPayment;
    state.players[player].life = lifeAfterPayment;
    if (exactResult) {
      state.players[player].trackedMana = exactResult.remainingTrackedMana;
    }

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

    return { spentTrackedMana, spentMana };
  }

  emptyPool(state: GameState, player: PlayerId): void {
    state.players[player].manaPool = emptyManaPool();
    state.players[player].trackedMana = [];
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
    battlefield: CardInstance[] = state.zones[player].BATTLEFIELD,
    context?: PayManaContext,
  ): boolean {
    const effectiveCost: ManaCost = cost.X > 0 ? { ...cost, X: 0 } : cost;
    const sources = this.getManaSources(state, player, battlefield, context);
    return this.findSourcePaymentPlan(
      { ...state.players[player].manaPool },
      [...state.players[player].trackedMana],
      effectiveCost,
      state.players[player].life,
      sources,
      context,
    ) !== null;
  }

  autoTapForCost(
    state: GameState,
    player: PlayerId,
    cost: ManaCost,
    battlefield: CardInstance[],
    context?: PayManaContext,
  ): AutoTapPlanEntry[] | null {
    const sources = this.getManaSources(state, player, battlefield, context);
    const plan = this.findSourcePaymentPlan(
      { ...state.players[player].manaPool },
      [...state.players[player].trackedMana],
      cost,
      state.players[player].life,
      sources,
      context,
    );

    return plan?.plan ?? null;
  }

  private normalizeProducedColor(state: GameState, player: PlayerId, color: ManaSymbol): ManaSymbol {
    if (color === 'C') {
      return 'C';
    }
    return state.players[player].colorIdentity.includes(color as ManaColor) ? color : 'C';
  }

  private manaRestrictionAllowsContext(
    restriction: ManaSpendRestriction | undefined,
    context?: PayManaContext,
  ): boolean {
    if (!restriction) {
      return true;
    }

    switch (restriction.kind) {
      case 'powerstone':
        return !context?.spellDefinition || context.spellDefinition.types.includes('Artifact' as import('./types').CardType);
      default:
        return true;
    }
  }

  private appendTrackedManaFromOption(
    trackedMana: TrackedMana[],
    option: AutoTapPlanEntry,
    actualMana: Partial<ManaPool>,
  ): TrackedMana[] {
    if (!option.trackedManaEffect && !option.manaRestriction) {
      return trackedMana;
    }

    const appended = [...trackedMana];
    for (const color of Object.keys(actualMana) as ManaSymbol[]) {
      const amount = actualMana[color] ?? 0;
      for (let index = 0; index < amount; index += 1) {
        appended.push({
          color,
          sourceId: option.sourceId,
          effect: option.trackedManaEffect,
          restriction: option.manaRestriction,
        });
      }
    }
    return appended;
  }

  private getManaSources(
    state: GameState,
    player: PlayerId,
    battlefield: CardInstance[],
    context?: PayManaContext,
  ): ManaSource[] {
    return battlefield
      .filter(card => card.controller === player && !card.tapped)
      .flatMap((card) => {
        const manaAbilities = getEffectiveAbilities(card)
          .filter((candidate) => candidate.kind === 'activated' && candidate.isManaAbility)
          .map((candidate) => ActivatedAbility.from(candidate as ActivatedAbilityDef));
        if (manaAbilities.length === 0) {
          return [];
        }

        const options = manaAbilities.flatMap((aa) => {
          if (!this.canActivateManaAbility(card, aa, state)) {
            return [];
          }

          const productions = this.getManaProductions(card, aa, state.players[player].colorIdentity)
            .filter((production) => this.manaRestrictionAllowsContext(production.restriction, context));
          if (productions.length === 0) {
            return [];
          }

          const triggeredBonuses = aa.requiresTap() && hasType(card, 'Creature' as import('./types').CardType)
            ? this.getTriggeredTapForManaBonuses(state, player, card)
            : [{}];

          return productions.flatMap((production) =>
            this.expandManaProduction(production, state.players[player].colorIdentity).flatMap((baseMana) =>
              triggeredBonuses.map((bonusMana) => ({
                sourceId: card.objectId,
                mana: baseMana,
                plannerMana: this.mergeManaMaps(baseMana, bonusMana),
                tap: aa.requiresTap(),
                sacrificeSelf: aa.requiresSelfSacrifice(),
                trackedManaEffect: aa.getTrackedManaEffect(),
                manaRestriction: production.restriction,
              }))
            )
          );
        });

        if (options.length === 0) {
          return [];
        }

        return [{
          sourceId: card.objectId,
          options,
        }];
      });
  }

  private canActivateManaAbility(card: CardInstance, aa: ActivatedAbility, state: GameState): boolean {
    if (!aa.requiresTap()) {
      return true;
    }
    if (!hasType(card, 'Creature' as import('./types').CardType)) {
      return true;
    }
    if (!card.summoningSick) {
      return true;
    }
    return getActivationRuleProfile(card, state).ignoreTapSummoningSickness;
  }

  private getManaProductions(
    card: CardInstance,
    aa: ActivatedAbility,
    colorIdentity: ManaColor[],
  ): ManaProduction[] {
    const manaProduction = aa.getManaProduction();
    if (manaProduction && manaProduction.length > 0) {
      return manaProduction;
    }

    const subtypes = getEffectiveSubtypes(card);
    if (subtypes.includes('Plains')) return [{ amount: 1, colors: ['W'] }];
    if (subtypes.includes('Island')) return [{ amount: 1, colors: ['U'] }];
    if (subtypes.includes('Swamp')) return [{ amount: 1, colors: ['B'] }];
    if (subtypes.includes('Mountain')) return [{ amount: 1, colors: ['R'] }];
    if (subtypes.includes('Forest')) return [{ amount: 1, colors: ['G'] }];

    const lower = aa.getDescription().toLowerCase();
    if (lower.includes('commander') && lower.includes('any color')) {
      const colors = colorIdentity.length > 0 ? colorIdentity : ['C'];
      return [{ amount: 1, colors: colors as ManaSymbol[], restrictToColorIdentity: true }];
    }
    if (lower.includes('any color')) {
      return [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }];
    }

    const parsed: ManaProduction[] = [];
    for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
      const matches = aa.getDescription().match(new RegExp(`\\{${color}\\}`, 'g'));
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

  private expandManaProduction(
    production: ManaProduction,
    colorIdentity: ManaColor[],
  ): Partial<ManaPool>[] {
    return this.normalizeProductionColors(production, colorIdentity).map((color) => ({
      [color]: production.amount,
    }));
  }

  private mergeManaMaps(a: Partial<ManaPool>, b: Partial<ManaPool>): Partial<ManaPool> {
    const merged: Partial<ManaPool> = { ...a };
    for (const color of Object.keys(b) as ManaSymbol[]) {
      merged[color] = (merged[color] ?? 0) + (b[color] ?? 0);
    }
    return merged;
  }

  private diffManaPools(before: ManaPool, after: ManaPool): ManaPool {
    return {
      W: Math.max(0, before.W - after.W),
      U: Math.max(0, before.U - after.U),
      B: Math.max(0, before.B - after.B),
      R: Math.max(0, before.R - after.R),
      G: Math.max(0, before.G - after.G),
      C: Math.max(0, before.C - after.C),
    };
  }

  private consumeTrackedMana(
    state: GameState,
    player: PlayerId,
    spentMana: ManaPool,
    context?: PayManaContext,
  ): TrackedMana[] {
    const spentBudget: ManaPool = { ...spentMana };
    const trackedMana = state.players[player].trackedMana;
    const preferred: number[] = [];
    const fallback: number[] = [];

    for (let index = 0; index < trackedMana.length; index += 1) {
      const entry = trackedMana[index];
      if (entry.effect && this.trackedManaEffectAppliesToSpell(entry.effect, context?.spellDefinition)) {
        preferred.push(index);
      } else {
        fallback.push(index);
      }
    }

    const consumed = this.consumeTrackedManaIndexes(trackedMana, spentBudget, preferred);
    consumed.push(...this.consumeTrackedManaIndexes(trackedMana, spentBudget, fallback));

    const consumedSet = new Set(consumed);
    state.players[player].trackedMana = trackedMana.filter((_, index) => !consumedSet.has(index));
    return consumed.map((index) => trackedMana[index]);
  }

  private consumeTrackedManaIndexes(
    trackedMana: TrackedMana[],
    spentBudget: ManaPool,
    indexes: number[],
  ): number[] {
    const consumed: number[] = [];
    for (const index of indexes) {
      const entry = trackedMana[index];
      if (spentBudget[entry.color] <= 0) {
        continue;
      }
      spentBudget[entry.color] -= 1;
      consumed.push(index);
    }
    return consumed;
  }

  private trackedManaEffectAppliesToSpell(
    effect: TrackedManaEffect,
    spellDefinition?: CardDefinition,
  ): boolean {
    if (!spellDefinition) {
      return false;
    }

    switch (effect.kind) {
      case 'etb-counter-on-non-human-creature':
        return spellDefinition.types.includes('Creature' as import('./types').CardType) && !spellDefinition.subtypes.includes('Human');
      default:
        return false;
    }
  }

  private getTriggeredTapForManaBonuses(
    state: GameState,
    player: PlayerId,
    tappedCreature: CardInstance,
  ): Partial<ManaPool>[] {
    let bonusOptions: Partial<ManaPool>[] = [{}];

    for (const source of state.zones[player].BATTLEFIELD) {
      if (source.phasedOut) continue;
      const abilities = getEffectiveAbilities(source);
      for (const ability of abilities) {
        if (ability.kind !== 'triggered') continue;
        const ta = TriggeredAbility.from(ability);
        if (!ta.matchesTapForManaTrigger(tappedCreature, source.controller, state)) continue;

        const expanded = ta.getManaProduction()!.flatMap((production) =>
          this.expandManaProduction(production, state.players[player].colorIdentity)
        );
        bonusOptions = bonusOptions.flatMap((existing) =>
          expanded.map((bonus) => this.mergeManaMaps(existing, bonus))
        );
      }
    }

    return bonusOptions;
  }

  private matchesCardFilter(
    card: CardInstance,
    filter: import('./types').CardFilter,
    sourceController: PlayerId,
    state: GameState,
  ): boolean {
    if (filter.types && !filter.types.some(type => hasType(card, type))) return false;
    if (filter.subtypes && !filter.subtypes.some(subtype => getEffectiveSubtypes(card).includes(subtype))) return false;
    if (filter.supertypes && !filter.supertypes.some(supertype => getEffectiveSupertypes(card).includes(supertype))) return false;
    if (filter.colors && !filter.colors.some(color => card.definition.colorIdentity.includes(color))) return false;
    if (filter.controller === 'you' && card.controller !== sourceController) return false;
    if (filter.controller === 'opponent' && card.controller === sourceController) return false;
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.tapped === true && !card.tapped) return false;
    if (filter.tapped === false && card.tapped) return false;
    if (filter.isToken === true && !card.isToken) return false;
    if (filter.custom && !filter.custom(card, state)) return false;
    return true;
  }

  private findSourcePaymentPlan(
    pool: ManaPool,
    trackedMana: TrackedMana[],
    cost: ManaCost,
    life: number,
    sources: ManaSource[],
    context?: PayManaContext,
    index = 0,
    plan: AutoTapPlanEntry[] = [],
  ): { plan: AutoTapPlanEntry[]; result: PaymentResult } | null {
    const directPayment = this.solvePaymentWithTrackedMana(pool, trackedMana, cost, life, context)
      ?? this.solvePaymentFromPool(pool, cost, life);
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

    const skipped = this.findSourcePaymentPlan(pool, trackedMana, cost, life, sources, context, index + 1, plan);
    if (skipped) {
      return skipped;
    }

    for (const option of source.options) {
      const nextPool = { ...pool };
      const producedMana = option.plannerMana ?? option.mana;
      for (const color of Object.keys(producedMana) as ManaSymbol[]) {
        nextPool[color] += producedMana[color] ?? 0;
      }
      const nextTrackedMana = this.appendTrackedManaFromOption(trackedMana, option, option.mana);
      plan.push(option);
      const result = this.findSourcePaymentPlan(
        nextPool,
        nextTrackedMana,
        cost,
        life,
        sources,
        context,
        index + 1,
        plan,
      );
      if (result) {
        return result;
      }
      plan.pop();
    }

    return null;
  }

  private solvePaymentWithTrackedMana(
    pool: ManaPool,
    trackedMana: TrackedMana[],
    cost: ManaCost,
    life: number,
    context?: PayManaContext,
  ): ExactPaymentResult | null {
    if (!trackedMana.some((entry) => entry.restriction)) {
      return null;
    }

    const units = this.buildExactManaUnits(pool, trackedMana);
    const allIndexes = units.map((_, index) => index);
    const remainingIndexes = this.resolveExactPayment(
      units,
      trackedMana,
      allIndexes,
      cost,
      life,
      context,
    );
    if (!remainingIndexes) {
      return null;
    }

    const remainingSet = new Set(remainingIndexes.indexes);
    const spentTrackedIndexes = new Set<number>();
    for (const [unitIndex, unit] of units.entries()) {
      if (unit.trackedIndex === undefined) {
        continue;
      }
      if (!remainingSet.has(unitIndex)) {
        spentTrackedIndexes.add(unit.trackedIndex);
      }
    }

    return {
      pool: this.countExactUnitsToPool(units, remainingIndexes.indexes),
      life: remainingIndexes.life,
      remainingTrackedMana: trackedMana.filter((_, index) => !spentTrackedIndexes.has(index)),
      spentTrackedMana: [...spentTrackedIndexes].sort((a, b) => a - b).map((index) => trackedMana[index]),
    };
  }

  private buildExactManaUnits(pool: ManaPool, trackedMana: TrackedMana[]): ExactManaUnit[] {
    const remainingPool = { ...pool };
    const units: ExactManaUnit[] = [];

    for (const [trackedIndex, entry] of trackedMana.entries()) {
      if (remainingPool[entry.color] <= 0) {
        continue;
      }
      remainingPool[entry.color] -= 1;
      units.push({
        color: entry.color,
        trackedIndex,
      });
    }

    for (const color of ['W', 'U', 'B', 'R', 'G', 'C'] as const) {
      for (let count = 0; count < remainingPool[color]; count += 1) {
        units.push({ color });
      }
    }

    return units;
  }

  private resolveExactPayment(
    units: ExactManaUnit[],
    trackedMana: TrackedMana[],
    indexes: number[],
    cost: ManaCost,
    life: number,
    context?: PayManaContext,
  ): { indexes: number[]; life: number } | null {
    let remaining = [...indexes];

    for (const color of ['W', 'U', 'B', 'R', 'G'] as const) {
      remaining = this.consumeExactColoredUnits(units, trackedMana, remaining, color, cost[color], context);
      if (!remaining) {
        return null;
      }
    }

    remaining = this.consumeExactColoredUnits(units, trackedMana, remaining, 'C', cost.C, context);
    if (!remaining) {
      return null;
    }

    return this.resolveExactSpecialSymbols(
      units,
      trackedMana,
      remaining,
      cost.generic,
      [...(cost.hybrid ?? [])],
      [...(cost.phyrexian ?? [])],
      life,
      context,
    );
  }

  private resolveExactSpecialSymbols(
    units: ExactManaUnit[],
    trackedMana: TrackedMana[],
    indexes: number[],
    generic: number,
    hybrid: string[],
    phyrexian: ManaColor[],
    life: number,
    context?: PayManaContext,
  ): { indexes: number[]; life: number } | null {
    if (hybrid.length > 0) {
      const [symbol, ...rest] = hybrid;
      for (const candidate of this.getExactHybridPaymentCandidates(units, trackedMana, indexes, symbol, context)) {
        const result = this.resolveExactSpecialSymbols(
          units,
          trackedMana,
          candidate,
          generic,
          rest,
          phyrexian,
          life,
          context,
        );
        if (result) {
          return result;
        }
      }
      return null;
    }

    if (phyrexian.length > 0) {
      const [color, ...rest] = phyrexian;
      const manaPaid = this.consumeExactColoredUnits(units, trackedMana, indexes, color, 1, context);
      if (manaPaid) {
        const result = this.resolveExactSpecialSymbols(
          units,
          trackedMana,
          manaPaid,
          generic,
          hybrid,
          rest,
          life,
          context,
        );
        if (result) {
          return result;
        }
      }
      if (life >= 2) {
        const result = this.resolveExactSpecialSymbols(
          units,
          trackedMana,
          indexes,
          generic,
          hybrid,
          rest,
          life - 2,
          context,
        );
        if (result) {
          return result;
        }
      }
      return null;
    }

    const genericPaid = this.consumeExactGenericUnits(units, trackedMana, indexes, generic, context);
    if (!genericPaid) {
      return null;
    }

    return {
      indexes: genericPaid,
      life,
    };
  }

  private consumeExactColoredUnits(
    units: ExactManaUnit[],
    trackedMana: TrackedMana[],
    indexes: number[],
    color: ManaSymbol,
    amount: number,
    context?: PayManaContext,
  ): number[] | null {
    let remaining = [...indexes];
    for (let count = 0; count < amount; count += 1) {
      const candidate = this.sortExactUnitCandidates(
        remaining.filter((index) =>
          units[index].color === color && this.isExactUnitSpendable(units[index], trackedMana, context)
        ),
        units,
        trackedMana,
        context,
      )[0];
      if (candidate === undefined) {
        return null;
      }
      remaining = remaining.filter((index) => index !== candidate);
    }
    return remaining;
  }

  private consumeExactGenericUnits(
    units: ExactManaUnit[],
    trackedMana: TrackedMana[],
    indexes: number[],
    amount: number,
    context?: PayManaContext,
  ): number[] | null {
    let remaining = [...indexes];
    const sortedCandidates = this.sortExactUnitCandidates(
      remaining.filter((index) => this.isExactUnitSpendable(units[index], trackedMana, context)),
      units,
      trackedMana,
      context,
    );
    if (sortedCandidates.length < amount) {
      return null;
    }

    for (let count = 0; count < amount; count += 1) {
      remaining = remaining.filter((index) => index !== sortedCandidates[count]);
    }

    return remaining;
  }

  private getExactHybridPaymentCandidates(
    units: ExactManaUnit[],
    trackedMana: TrackedMana[],
    indexes: number[],
    symbol: string,
    context?: PayManaContext,
  ): number[][] {
    if (symbol.startsWith('2/')) {
      const color = symbol.split('/')[1] as ManaColor;
      const candidates: number[][] = [];
      const colored = this.consumeExactColoredUnits(units, trackedMana, indexes, color, 1, context);
      if (colored) {
        candidates.push(colored);
      }
      const generic = this.consumeExactGenericUnits(units, trackedMana, indexes, 2, context);
      if (generic) {
        candidates.push(generic);
      }
      return candidates;
    }

    const colors = symbol.split('/').filter((part): part is ManaColor =>
      part === 'W' || part === 'U' || part === 'B' || part === 'R' || part === 'G'
    );
    return colors
      .map((color) => this.consumeExactColoredUnits(units, trackedMana, indexes, color, 1, context))
      .filter((candidate): candidate is number[] => candidate !== null);
  }

  private isExactUnitSpendable(
    unit: ExactManaUnit,
    trackedMana: TrackedMana[],
    context?: PayManaContext,
  ): boolean {
    if (unit.trackedIndex === undefined) {
      return true;
    }
    return this.manaRestrictionAllowsContext(trackedMana[unit.trackedIndex]?.restriction, context);
  }

  private sortExactUnitCandidates(
    indexes: number[],
    units: ExactManaUnit[],
    trackedMana: TrackedMana[],
    context?: PayManaContext,
  ): number[] {
    return [...indexes].sort((left, right) => {
      const leftPriority = this.getExactUnitPriority(units[left], trackedMana, context);
      const rightPriority = this.getExactUnitPriority(units[right], trackedMana, context);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      if (units[left].color !== units[right].color) {
        return units[left].color === 'C' ? -1 : 1;
      }
      return left - right;
    });
  }

  private getExactUnitPriority(
    unit: ExactManaUnit,
    trackedMana: TrackedMana[],
    context?: PayManaContext,
  ): number {
    if (unit.trackedIndex === undefined) {
      return 2;
    }

    const trackedEntry = trackedMana[unit.trackedIndex];
    if (trackedEntry?.effect && this.trackedManaEffectAppliesToSpell(trackedEntry.effect, context?.spellDefinition)) {
      return 0;
    }

    return 1;
  }

  private countExactUnitsToPool(units: ExactManaUnit[], indexes: number[]): ManaPool {
    const pool = emptyManaPool();
    for (const index of indexes) {
      pool[units[index].color] += 1;
    }
    return pool;
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
