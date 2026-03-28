import type { CardInstance } from '../types/cards';
import type { ObjectId, PlayerId, Zone, CardType as CardTypeEnum } from '../types/core';
import type { ChoiceHelper } from '../types/effects';
import type { CardFilter } from '../types/filters';
import type {
  ManaCost,
  ManaPool,
  ManaSymbol,
  TrackedMana,
} from '../types/mana';
import type { CardDefinition } from '../types/spells';
import type { GameState } from '../types/state';
import type { GenericTapSubstitution, PlainCost } from '../types/costs';
import { emptyManaCost, manaCostTotal } from '../types/mana';
import { CardType } from '../types/core';
import type { AutoTapPlanEntry, PayManaContext, PayManaResult } from '../ManaManager';

/**
 * Operations the Cost class needs from the engine to pay costs.
 * Provided by the engine at call sites — keeps Cost decoupled from the concrete GameEngine.
 */
export interface CostContext {
  game: GameState;
  source: CardInstance;
  playerId: PlayerId;
  choices: ChoiceHelper;

  // Game actions
  loseLife(player: PlayerId, amount: number): void;
  sacrificePermanent(objectId: ObjectId, controller: PlayerId): void;
  sacrificePermanents(player: PlayerId, filter: CardFilter, count: number, prompt?: string): Promise<CardInstance[]>;
  removeCounters(objectId: ObjectId, counterType: string, amount: number): void;
  moveCard(objectId: ObjectId, toZone: Zone, toOwner?: PlayerId): void;
  discardCard(player: PlayerId, objectId: ObjectId): void;
  tapPermanent(objectId: ObjectId): void;

  // Query
  matchesFilter(card: CardInstance, filter: CardFilter, controller?: PlayerId): boolean;
  getBattlefield(filter?: CardFilter, controller?: PlayerId): CardInstance[];
  hasType(card: CardInstance, type: CardTypeEnum): boolean;

  // Mana
  canPayMana(player: PlayerId, cost: ManaCost): boolean;
  payMana(player: PlayerId, cost: ManaCost): boolean;
  payManaWithContext(player: PlayerId, cost: ManaCost, context?: PayManaContext): PayManaResult | null;
  autoTapForCost(player: PlayerId, cost: ManaCost, battlefield: CardInstance[]): AutoTapPlanEntry[] | null;
  canAffordWithManaProduction(player: PlayerId, cost: ManaCost, battlefield: CardInstance[]): boolean;
  applyAutoTapPlan(playerId: PlayerId, plan: AutoTapPlanEntry[]): void;

  // Options
  reservedTapSourceIds?: Set<ObjectId>;
  excludeSourceFromHandDiscard?: boolean;
  spellDefinition?: CardDefinition;
}

export interface CostPayResult {
  success: boolean;
  spentTrackedMana?: TrackedMana[];
}

/**
 * Opaque cost object. The engine manipulates costs through this class's methods
 * instead of reading/writing cost properties directly.
 */
export class Cost {
  private _mana: ManaCost | undefined;
  private _convoke: boolean;
  private _delve: boolean;
  private _tap: boolean;
  private _genericTapSubstitution: GenericTapSubstitution | undefined;
  private _sacrifice: CardFilter | undefined;
  private _discard: CardFilter | number | undefined;
  private _payLife: number | undefined;
  private _exileFromGraveyard: CardFilter | number | undefined;
  private _removeCounters: { type: string; count: number } | undefined;
  private _custom: ((game: GameState, source: CardInstance, player: PlayerId) => boolean) | undefined;

  private constructor() {
    this._convoke = false;
    this._delve = false;
    this._tap = false;
  }

  // ---------------------------------------------------------------------------
  // Construction
  // ---------------------------------------------------------------------------

  static from(plain: PlainCost | undefined): Cost {
    const cost = new Cost();
    if (!plain) return cost;
    cost._mana = plain.mana ? cloneManaCost(plain.mana) : undefined;
    cost._convoke = plain.convoke ?? false;
    cost._delve = plain.delve ?? false;
    cost._tap = plain.tap ?? false;
    cost._genericTapSubstitution = plain.genericTapSubstitution
      ? { ...plain.genericTapSubstitution, filter: { ...plain.genericTapSubstitution.filter } }
      : undefined;
    cost._sacrifice = plain.sacrifice ? { ...plain.sacrifice } : undefined;
    cost._discard = typeof plain.discard === 'number'
      ? plain.discard
      : plain.discard ? { ...plain.discard } : undefined;
    cost._payLife = plain.payLife;
    cost._exileFromGraveyard = typeof plain.exileFromGraveyard === 'number'
      ? plain.exileFromGraveyard
      : plain.exileFromGraveyard ? { ...plain.exileFromGraveyard } : undefined;
    cost._removeCounters = plain.removeCounters
      ? { ...plain.removeCounters }
      : undefined;
    cost._custom = plain.custom;
    return cost;
  }

  static empty(): Cost {
    return new Cost();
  }

  // ---------------------------------------------------------------------------
  // Opaque interface — canPay / pay
  // ---------------------------------------------------------------------------

  /**
   * Returns true if the player can afford the full cost (mana + non-mana parts).
   * Does NOT account for potential mana from tapping sources — use canAffordMana()
   * for the full affordability check including mana production.
   */
  canPay(ctx: CostContext): boolean {
    return this.canPayNonManaParts(ctx) && this.canAffordMana(ctx);
  }

  /**
   * Execute the full payment: tap source, auto-tap lands, pay mana, pay non-mana costs.
   */
  async pay(ctx: CostContext): Promise<CostPayResult> {
    // Tap source if needed
    if (this._tap) {
      ctx.tapPermanent(ctx.source.objectId);
    }

    // Pay mana if needed
    const manaResult = this.payMana(ctx);
    if (manaResult === false) return { success: false };

    // Pay non-mana costs
    const nonManaSuccess = await this.payNonManaParts(ctx);
    return {
      success: nonManaSuccess,
      spentTrackedMana: manaResult?.spentTrackedMana,
    };
  }

  /**
   * Check if the non-mana parts of this cost can be paid (sacrifice, discard, counters, custom).
   * Does NOT check mana affordability.
   */
  canPayNonMana(ctx: CostContext): boolean {
    return this.canPayNonManaParts(ctx);
  }

  /**
   * Pay only the non-mana parts of this cost (sacrifice, discard, life, exile, counters, custom).
   * Used when mana is handled separately (e.g., additional costs during spell casting).
   */
  async payNonMana(ctx: CostContext): Promise<boolean> {
    return this.payNonManaParts(ctx);
  }

  /**
   * Auto-tap lands and pay mana from the player's pool.
   * Returns null if there's no mana to pay, false if payment fails, or the payment result.
   */
  payMana(ctx: CostContext): PayManaResult | null | false {
    if (!this._mana || manaCostTotal(this._mana) <= 0) return null;

    const battlefield = ctx.getBattlefield(undefined, ctx.playerId).filter(
      card => !ctx.reservedTapSourceIds?.has(card.objectId),
    );
    const plan = ctx.autoTapForCost(ctx.playerId, this._mana, battlefield);
    if (plan) {
      ctx.applyAutoTapPlan(ctx.playerId, plan);
    }

    const result = ctx.payManaWithContext(
      ctx.playerId,
      this._mana,
      ctx.spellDefinition ? { spellDefinition: ctx.spellDefinition } : undefined,
    );
    return result ?? false;
  }

  // ---------------------------------------------------------------------------
  // Mana mutations
  // ---------------------------------------------------------------------------

  /** Add mana to the cost (commander tax, additional costs). */
  addManaTax(delta: Partial<ManaCost>): void {
    if (!this._mana) {
      this._mana = emptyManaCost();
    }
    applyManaDelta(this._mana, delta, 'add');
  }

  /** Apply a cost reduction (affinity, cost-modification effects). */
  applyReduction(delta: Partial<ManaCost>): void {
    if (!this._mana) return;
    applyManaDelta(this._mana, delta, 'reduce');
  }

  /** Resolve X spells: add X * xValue to generic, then zero out X. */
  resolveX(xValue: number): void {
    if (!this._mana || this._mana.X <= 0) return;
    this._mana.generic += xValue * this._mana.X;
    this._mana.X = 0;
  }

  /**
   * Merge an override cost onto this base cost. Override properties take precedence
   * (e.g., alternative cost mana replaces base mana, flags are ORed).
   * Used for alternative costs like flashback where the override replaces the base.
   */
  static merge(base: Cost, override: Cost): Cost {
    const merged = base.clone();
    // Override's mana replaces base's mana
    if (override._mana) merged._mana = cloneManaCost(override._mana);
    // Override flags take precedence
    if (override._convoke) merged._convoke = true;
    if (override._delve) merged._delve = true;
    if (override._tap) merged._tap = true;
    if (override._genericTapSubstitution) {
      merged._genericTapSubstitution = {
        ...override._genericTapSubstitution,
        filter: { ...override._genericTapSubstitution.filter },
      };
    }
    // Override non-mana cost parts
    if (override._sacrifice) merged._sacrifice = { ...override._sacrifice };
    if (override._discard !== undefined) {
      merged._discard = typeof override._discard === 'number'
        ? override._discard
        : { ...override._discard };
    }
    if (override._payLife !== undefined) merged._payLife = override._payLife;
    if (override._exileFromGraveyard !== undefined) {
      merged._exileFromGraveyard = typeof override._exileFromGraveyard === 'number'
        ? override._exileFromGraveyard
        : { ...override._exileFromGraveyard };
    }
    if (override._removeCounters) merged._removeCounters = { ...override._removeCounters };
    if (override._custom) merged._custom = override._custom;
    return merged;
  }

  /** Combine this cost's mana with another cost's mana (fused split cards, additional costs). */
  combineWith(other: Cost): Cost {
    const combined = this.clone();
    if (other._mana) {
      combined._mana = addManaCosts(combined._mana ?? emptyManaCost(), other._mana);
    }
    // Merge boolean flags
    if (other._convoke) combined._convoke = true;
    if (other._delve) combined._delve = true;
    if (other._tap) combined._tap = true;
    if (other._genericTapSubstitution && !combined._genericTapSubstitution) {
      combined._genericTapSubstitution = other._genericTapSubstitution
        ? { ...other._genericTapSubstitution, filter: { ...other._genericTapSubstitution.filter } }
        : undefined;
    }
    return combined;
  }

  /** Add only the mana portion from another cost. */
  addManaCostFrom(other: Cost): void {
    if (other._mana) {
      this._mana = addManaCosts(this._mana ?? emptyManaCost(), other._mana);
    }
  }

  // ---------------------------------------------------------------------------
  // Async modifiers (delve, convoke, generic tap substitution)
  // ---------------------------------------------------------------------------

  /** Apply delve, convoke, and generic tap substitution. Must be called before pay(). */
  async applyModifiers(ctx: CostContext): Promise<boolean> {
    if (!this._mana) return true;

    // Delve
    if (this._delve && this._mana.generic > 0) {
      const graveyard = ctx.game.zones[ctx.playerId].GRAVEYARD.filter(
        card => card.objectId !== ctx.source.objectId,
      );
      if (graveyard.length > 0) {
        const selected = await ctx.choices.chooseUpToN(
          `Choose up to ${this._mana.generic} card(s) to exile for delve`,
          graveyard,
          Math.min(this._mana.generic, graveyard.length),
          card => card.definition.name,
        );
        for (const card of selected) {
          ctx.moveCard(card.objectId, 'EXILE', ctx.playerId);
        }
        this._mana.generic = Math.max(0, this._mana.generic - selected.length);
      }
    }

    // Convoke
    if (this._convoke) {
      const creatures = ctx.game.zones[ctx.playerId].BATTLEFIELD.filter(card =>
        !card.phasedOut &&
        !card.tapped &&
        ctx.hasType(card, CardType.CREATURE as CardTypeEnum),
      );
      const maxConvoke = Math.min(manaCostTotal(this._mana), creatures.length);
      if (maxConvoke > 0) {
        const selected = await ctx.choices.chooseUpToN(
          `Choose up to ${maxConvoke} creature(s) to tap for convoke`,
          creatures,
          maxConvoke,
          card => card.definition.name,
        );
        for (const creature of selected) {
          ctx.tapPermanent(creature.objectId);
          const colors = creature.definition.colorIdentity;
          const payableColor = colors.find(
            color => this._mana![color as keyof ManaCost] as number > 0,
          ) as ManaSymbol | undefined;
          if (payableColor) {
            (this._mana as unknown as Record<string, number>)[payableColor] = Math.max(
              0,
              (this._mana as unknown as Record<string, number>)[payableColor] - 1,
            );
          } else {
            this._mana.generic = Math.max(0, this._mana.generic - 1);
          }
        }
      }
    }

    // Generic tap substitution
    if (this._genericTapSubstitution && this._genericTapSubstitution.amount > 0 && this._mana.generic > 0) {
      const candidates = this.getGenericTapSubstitutionCandidates(ctx);
      const maxSelections = Math.min(
        this._genericTapSubstitution.amount,
        this._mana.generic,
        candidates.length,
      );
      if (maxSelections > 0) {
        const selected = await ctx.choices.chooseUpToN(
          `Choose up to ${maxSelections} artifact(s) and/or creature(s) to tap for generic mana`,
          candidates,
          maxSelections,
          card => card.definition.name,
        );
        const uniqueSelections = selected.filter((card, index) =>
          selected.findIndex(c => c.objectId === card.objectId) === index,
        );
        for (const card of uniqueSelections) {
          ctx.tapPermanent(card.objectId);
        }
        this._mana.generic = Math.max(0, this._mana.generic - uniqueSelections.length);
      }
    }

    return true;
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Converted mana cost (for CMC checks). */
  getManaValue(): number {
    return this._mana ? manaCostTotal(this._mana) : 0;
  }

  /** Is this a zero/empty cost? */
  isEmpty(): boolean {
    return !this._mana && !this._tap && !this._sacrifice && !this._discard &&
      this._payLife === undefined && !this._exileFromGraveyard &&
      !this._removeCounters && !this._custom;
  }

  /** Does this cost include tapping the source? */
  requiresTap(): boolean {
    return this._tap;
  }

  /** Check if mana can be paid from pool + potential mana production. */
  canAffordMana(ctx: CostContext): boolean {
    if (!this._mana) return true;
    const battlefield = ctx.getBattlefield(undefined, ctx.playerId).filter(
      card => !ctx.reservedTapSourceIds?.has(card.objectId),
    );
    return ctx.canAffordWithManaProduction(ctx.playerId, this._mana, battlefield);
  }

  /** Get the generic tap substitution config (for the backtracking solver). */
  getGenericTapSubstitution(): GenericTapSubstitution | undefined {
    return this._genericTapSubstitution;
  }

  /** Get a snapshot of the internal mana cost for the affordability solver. */
  getManaCostSnapshot(): ManaCost | undefined {
    return this._mana ? cloneManaCost(this._mana) : undefined;
  }

  /** Get the number of generic mana in the cost. */
  getGenericMana(): number {
    return this._mana?.generic ?? 0;
  }

  /** Create a ManaCost with adjusted generic for the tap substitution solver. */
  withReducedGeneric(reduction: number): ManaCost {
    if (!this._mana) return emptyManaCost();
    return {
      ...this._mana,
      generic: Math.max(0, this._mana.generic - reduction),
    };
  }

  // ---------------------------------------------------------------------------
  // Display
  // ---------------------------------------------------------------------------

  /** Returns a copy of the mana cost for UI rendering. */
  getDisplayMana(): ManaCost {
    return this._mana ? cloneManaCost(this._mana) : emptyManaCost();
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  clone(): Cost {
    const copy = new Cost();
    copy._mana = this._mana ? cloneManaCost(this._mana) : undefined;
    copy._convoke = this._convoke;
    copy._delve = this._delve;
    copy._tap = this._tap;
    copy._genericTapSubstitution = this._genericTapSubstitution
      ? { ...this._genericTapSubstitution, filter: { ...this._genericTapSubstitution.filter } }
      : undefined;
    copy._sacrifice = this._sacrifice ? { ...this._sacrifice } : undefined;
    copy._discard = typeof this._discard === 'number'
      ? this._discard
      : this._discard ? { ...this._discard } : undefined;
    copy._payLife = this._payLife;
    copy._exileFromGraveyard = typeof this._exileFromGraveyard === 'number'
      ? this._exileFromGraveyard
      : this._exileFromGraveyard ? { ...this._exileFromGraveyard } : undefined;
    copy._removeCounters = this._removeCounters
      ? { ...this._removeCounters }
      : undefined;
    copy._custom = this._custom;
    return copy;
  }

  /**
   * Convert back to a PlainCost. Used at boundaries where plain objects are still needed
   * (e.g., attack tax storage on CardInstance).
   */
  toPlainCost(): PlainCost {
    const plain: PlainCost = {};
    if (this._mana) plain.mana = cloneManaCost(this._mana);
    if (this._convoke) plain.convoke = true;
    if (this._delve) plain.delve = true;
    if (this._tap) plain.tap = true;
    if (this._genericTapSubstitution) {
      plain.genericTapSubstitution = {
        ...this._genericTapSubstitution,
        filter: { ...this._genericTapSubstitution.filter },
      };
    }
    if (this._sacrifice) plain.sacrifice = { ...this._sacrifice };
    if (this._discard !== undefined) {
      plain.discard = typeof this._discard === 'number'
        ? this._discard
        : { ...this._discard };
    }
    if (this._payLife !== undefined) plain.payLife = this._payLife;
    if (this._exileFromGraveyard !== undefined) {
      plain.exileFromGraveyard = typeof this._exileFromGraveyard === 'number'
        ? this._exileFromGraveyard
        : { ...this._exileFromGraveyard };
    }
    if (this._removeCounters) plain.removeCounters = { ...this._removeCounters };
    if (this._custom) plain.custom = this._custom;
    return plain;
  }

  // ---------------------------------------------------------------------------
  // Private: non-mana cost checks
  // ---------------------------------------------------------------------------

  private canPayNonManaParts(ctx: CostContext): boolean {
    if (this._exileFromGraveyard) {
      const graveyard = ctx.game.zones[ctx.playerId].GRAVEYARD.filter(
        card => card.objectId !== ctx.source.objectId,
      );
      if (typeof this._exileFromGraveyard === 'number') {
        if (graveyard.length < this._exileFromGraveyard) return false;
      } else {
        const matching = graveyard.filter(card =>
          ctx.matchesFilter(card, this._exileFromGraveyard as CardFilter, ctx.playerId),
        );
        if (matching.length === 0) return false;
      }
    }

    if (typeof this._discard === 'number' && this._discard > 0) {
      if (this.getDiscardCandidates(ctx).length < this._discard) return false;
    } else if (this._discard) {
      const matching = this.getDiscardCandidates(ctx).filter(card =>
        ctx.matchesFilter(card, this._discard as CardFilter, ctx.playerId),
      );
      if (matching.length === 0) return false;
    }

    if (this._removeCounters) {
      const currentCount = ctx.source.counters[this._removeCounters.type] ?? 0;
      if (currentCount < this._removeCounters.count) return false;
    }

    if (this._sacrifice) {
      if (this._sacrifice.self) {
        if (ctx.source.zone !== 'BATTLEFIELD') return false;
      } else {
        const battlefield = ctx.game.zones[ctx.playerId].BATTLEFIELD.filter(card =>
          !card.phasedOut && ctx.matchesFilter(card, this._sacrifice as CardFilter, ctx.playerId),
        );
        if (battlefield.length === 0) return false;
      }
    }

    if (this._custom && !this._custom(ctx.game, ctx.source, ctx.playerId)) {
      return false;
    }

    return true;
  }

  private async payNonManaParts(ctx: CostContext): Promise<boolean> {
    if (this._payLife) {
      ctx.loseLife(ctx.playerId, this._payLife);
    }

    if (this._exileFromGraveyard) {
      const graveyard = ctx.game.zones[ctx.playerId].GRAVEYARD.filter(
        card => card.objectId !== ctx.source.objectId,
      );
      if (typeof this._exileFromGraveyard === 'number') {
        if (graveyard.length < this._exileFromGraveyard) return false;
        const selected = await ctx.choices.chooseN(
          `Choose ${this._exileFromGraveyard} card(s) to exile from your graveyard`,
          graveyard,
          this._exileFromGraveyard,
          card => card.definition.name,
        );
        for (const card of selected) {
          ctx.moveCard(card.objectId, 'EXILE', ctx.playerId);
        }
      } else {
        const matching = graveyard.filter(card =>
          ctx.matchesFilter(card, this._exileFromGraveyard as CardFilter, ctx.playerId),
        );
        if (matching.length === 0) return false;
        const selected = await ctx.choices.chooseOne(
          'Choose a card to exile from your graveyard',
          matching,
          card => card.definition.name,
        );
        ctx.moveCard(selected.objectId, 'EXILE', ctx.playerId);
      }
    }

    if (typeof this._discard === 'number' && this._discard > 0) {
      const hand = this.getDiscardCandidates(ctx);
      if (hand.length < this._discard) return false;
      const selected = await ctx.choices.chooseN(
        `Choose ${this._discard} card(s) to discard`,
        hand,
        this._discard,
        card => card.definition.name,
      );
      for (const card of selected) {
        ctx.discardCard(ctx.playerId, card.objectId);
      }
    } else if (this._discard) {
      const matching = this.getDiscardCandidates(ctx).filter(card =>
        ctx.matchesFilter(card, this._discard as CardFilter, ctx.playerId),
      );
      if (matching.length === 0) return false;
      const selected = await ctx.choices.chooseOne(
        'Choose a card to discard',
        matching,
        card => card.definition.name,
      );
      ctx.discardCard(ctx.playerId, selected.objectId);
    }

    if (this._removeCounters) {
      const currentCount = ctx.source.counters[this._removeCounters.type] ?? 0;
      if (currentCount < this._removeCounters.count) return false;
      ctx.removeCounters(ctx.source.objectId, this._removeCounters.type, this._removeCounters.count);
    }

    if (this._sacrifice) {
      if (this._sacrifice.self) {
        ctx.sacrificePermanent(ctx.source.objectId, ctx.playerId);
      } else {
        const selected = await ctx.sacrificePermanents(
          ctx.playerId,
          this._sacrifice as CardFilter,
          1,
          'Choose a permanent to sacrifice',
        );
        if (selected.length === 0) return false;
      }
    }

    if (this._custom && !this._custom(ctx.game, ctx.source, ctx.playerId)) {
      return false;
    }

    return true;
  }

  private getDiscardCandidates(ctx: CostContext): CardInstance[] {
    return ctx.game.zones[ctx.playerId].HAND.filter(card => {
      if (!ctx.excludeSourceFromHandDiscard) return true;
      return card.objectId !== ctx.source.objectId;
    });
  }

  private getGenericTapSubstitutionCandidates(ctx: CostContext): CardInstance[] {
    if (!this._genericTapSubstitution) return [];
    const sub = this._genericTapSubstitution;
    return ctx.game.zones[ctx.playerId].BATTLEFIELD.filter(card => {
      if (card.phasedOut || card.tapped) return false;
      if (card.objectId === ctx.source.objectId) return false;
      if (ctx.reservedTapSourceIds?.has(card.objectId)) return false;
      if (!ctx.matchesFilter(card, sub.filter, ctx.playerId)) return false;
      if (!sub.ignoreSummoningSickness && card.summoningSick && ctx.hasType(card, CardType.CREATURE as CardTypeEnum)) {
        return false;
      }
      return true;
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

function cloneManaCost(cost: ManaCost): ManaCost {
  return {
    generic: cost.generic,
    W: cost.W,
    U: cost.U,
    B: cost.B,
    R: cost.R,
    G: cost.G,
    C: cost.C,
    X: cost.X,
    hybrid: cost.hybrid ? [...cost.hybrid] : undefined,
    phyrexian: cost.phyrexian ? [...cost.phyrexian] : undefined,
  };
}

function addManaCosts(base: ManaCost, extra: ManaCost): ManaCost {
  return {
    generic: base.generic + extra.generic,
    W: base.W + extra.W,
    U: base.U + extra.U,
    B: base.B + extra.B,
    R: base.R + extra.R,
    G: base.G + extra.G,
    C: base.C + extra.C,
    X: base.X + extra.X,
    hybrid: [...(base.hybrid ?? []), ...(extra.hybrid ?? [])],
    phyrexian: [...(base.phyrexian ?? []), ...(extra.phyrexian ?? [])],
  };
}

function applyManaDelta(cost: ManaCost, delta: Partial<ManaCost>, mode: 'add' | 'reduce'): void {
  const sign = mode === 'add' ? 1 : -1;
  cost.generic = Math.max(0, cost.generic + sign * (delta.generic ?? 0));
  cost.W = Math.max(0, cost.W + sign * (delta.W ?? 0));
  cost.U = Math.max(0, cost.U + sign * (delta.U ?? 0));
  cost.B = Math.max(0, cost.B + sign * (delta.B ?? 0));
  cost.R = Math.max(0, cost.R + sign * (delta.R ?? 0));
  cost.G = Math.max(0, cost.G + sign * (delta.G ?? 0));
  cost.C = Math.max(0, cost.C + sign * (delta.C ?? 0));
  cost.X = Math.max(0, cost.X + sign * (delta.X ?? 0));
}
