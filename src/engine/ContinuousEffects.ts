import type {
  CardFilter,
  CardInstance,
  CompiledInteractionHook,
  ContinuousEffect,
  GameState,
  ReplacementEffect,
  WouldEnterBattlefieldReplacementEffect,
} from './types';
import { CardType, GameEventType, Layer } from './types';
import { getEffectiveSubtypes, getEffectiveSupertypes, getEffectiveTypes, hasType } from './GameState';
import { StaticAbility } from './abilities';
import type { EffectCompilationContext } from './effects';
import { findCard } from './GameState';

/**
 * Implements the MTG Layer System (rule 613) for applying continuous effects.
 * Effects are applied in layer order, with timestamp ordering within each layer.
 */
export class ContinuousEffectsEngine {
  /**
   * Recalculate all continuous effects on all permanents.
   * Call this after any game state change that could affect continuous effects.
   */
  applyAll(state: GameState): void {
    // Reset computed values on all permanents
    this.resetComputedValues(state);

    // Remove expired effects
    state.continuousEffects = state.continuousEffects.filter(
      e => !this.isExpired(e, state)
    );

    const compiledStaticEffects = this.compileStaticContinuousEffects(state);

    // Sort effects by layer, then by timestamp (with dependency handling)
    const sorted = this.sortEffects([...state.continuousEffects, ...compiledStaticEffects]);

    // Apply effects in order
    for (const effect of sorted) {
      const affected = this.getAffectedPermanents(effect, state);
      for (const permanent of affected) {
        effect.apply(permanent, state);
      }
    }

    this.applyCounterAdjustments(state);
    state.replacementEffects = this.compileStaticReplacementEffects(state);
    state.wouldEnterBattlefieldReplacementEffects = this.compileStaticWouldEnterBattlefieldReplacementEffects(state);
    state.interactionHooks = this.compileStaticInteractionHooks(state);
  }

  /** Add a new continuous effect */
  addEffect(state: GameState, effect: ContinuousEffect): void {
    state.continuousEffects.push(effect);
    this.applyAll(state);
  }

  /** Remove effects from a specific source */
  removeEffectsFromSource(state: GameState, sourceId: string): void {
    state.continuousEffects = state.continuousEffects.filter(
      e => e.sourceId !== sourceId
    );
    this.applyAll(state);
  }

  private resetComputedValues(state: GameState): void {
    for (const pid of state.turnOrder) {
      for (const card of state.zones[pid].BATTLEFIELD) {
        // Layer 1: Copy effects — if this card copies another, use the copied card's
        // definition for base characteristics
        let baseDef = card.definition;
        if (card.copyOf) {
          const copiedCard = this.findCardById(state, card.copyOf);
          if (copiedCard) {
            baseDef = copiedCard.definition;
          }
        }

        // Transform / DFC: if transformed, use backFace for base characteristics
        if (card.isTransformed && baseDef.backFace) {
          baseDef = baseDef.backFace;
        }

        // Morph / Face-down: override to 2/2 colorless creature with no name/abilities
        if (card.faceDown && card.definition.morphCost) {
          card.modifiedTypes = [CardType.CREATURE];
          card.modifiedSubtypes = [];
          card.modifiedSupertypes = [];
          card.modifiedPower = 2;
          card.modifiedToughness = 2;
          card.modifiedAbilities = [];
        } else {
          card.modifiedTypes = [...baseDef.types];
          card.modifiedSubtypes = [...baseDef.subtypes];
          card.modifiedSupertypes = [...baseDef.supertypes];
          card.modifiedPower = baseDef.power;
          card.modifiedToughness = baseDef.toughness;
          card.modifiedAbilities = [...baseDef.abilities];
        }
        card.attackTaxes = [];
      }
    }
  }

  private applyCounterAdjustments(state: GameState): void {
    for (const pid of state.turnOrder) {
      for (const card of state.zones[pid].BATTLEFIELD) {
        if (card.phasedOut) continue;
        if (!hasType(card, CardType.CREATURE)) continue;
        const plusCounters = card.counters['+1/+1'] ?? 0;
        const minusCounters = card.counters['-1/-1'] ?? 0;
        if (card.modifiedPower !== undefined) {
          card.modifiedPower += plusCounters - minusCounters;
        }
        if (card.modifiedToughness !== undefined) {
          card.modifiedToughness += plusCounters - minusCounters;
        }
      }
    }
  }

  /** Find a card by objectId across all zones */
  private findCardById(state: GameState, objectId: string): import('./types').CardInstance | undefined {
    for (const pid of state.turnOrder) {
      for (const zoneCards of Object.values(state.zones[pid])) {
        const card = (zoneCards as import('./types').CardInstance[]).find(c => c.objectId === objectId);
        if (card) return card;
      }
    }
    return undefined;
  }

  private createCompilationContext(state: GameState, source: CardInstance, description: string): EffectCompilationContext {
    return {
      state,
      source,
      description,
      matchesFilter: (card, filter, src, st) => this.matchesFilter(card, filter, src, st),
      findCardById: (st, id) => findCard(st, id) ?? undefined,
    };
  }

  private compileStaticContinuousEffects(state: GameState): ContinuousEffect[] {
    const effects: ContinuousEffect[] = [];

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      for (const source of state.zones[playerId].BATTLEFIELD) {
        if (source.phasedOut) continue;
        const abilities = source.modifiedAbilities ?? source.definition.abilities;
        for (const ability of abilities) {
          if (ability.kind !== 'static') continue;
          const sa = StaticAbility.from(ability);
          if (!sa.isActive(state, source)) continue;

          const ctx = this.createCompilationContext(state, source, sa.getDescription());
          const compiled = sa.compile(ctx);
          if (compiled) {
            effects.push(compiled);
          }
        }
      }
    }

    return effects;
  }

  private compileStaticReplacementEffects(state: GameState): ReplacementEffect[] {
    const replacements: ReplacementEffect[] = [];

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      for (const source of state.zones[playerId].BATTLEFIELD) {
        if (source.phasedOut) continue;
        const abilities = source.modifiedAbilities ?? source.definition.abilities;
        for (const ability of abilities) {
          if (ability.kind !== 'static') continue;
          const sa = StaticAbility.from(ability);
          if (!sa.isActive(state, source)) continue;

          const ctx = this.createCompilationContext(state, source, sa.getDescription());
          const compiled = sa.compileReplacement(ctx, replacements.length);
          if (compiled) {
            replacements.push(compiled);
          }
        }
      }
    }

    return replacements;
  }

  private compileStaticWouldEnterBattlefieldReplacementEffects(state: GameState): WouldEnterBattlefieldReplacementEffect[] {
    const replacements: WouldEnterBattlefieldReplacementEffect[] = [];

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      for (const source of state.zones[playerId].BATTLEFIELD) {
        if (source.phasedOut) continue;
        const abilities = source.modifiedAbilities ?? source.definition.abilities;
        for (const ability of abilities) {
          if (ability.kind !== 'static') continue;
          const sa = StaticAbility.from(ability);
          if (!sa.isActive(state, source)) continue;

          const ctx = this.createCompilationContext(state, source, sa.getDescription());
          const compiled = sa.compileWouldEnterBattlefieldReplacement(ctx, replacements.length);
          if (compiled) {
            replacements.push(compiled);
          }
        }
      }
    }

    return replacements;
  }

  private compileStaticInteractionHooks(state: GameState): CompiledInteractionHook[] {
    const hooks: CompiledInteractionHook[] = [];

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      for (const source of state.zones[playerId].BATTLEFIELD) {
        if (source.phasedOut) continue;
        const abilities = source.modifiedAbilities ?? source.definition.abilities;
        for (const ability of abilities) {
          if (ability.kind !== 'static') continue;
          const sa = StaticAbility.from(ability);
          if (!sa.isActive(state, source)) continue;

          const ctx = this.createCompilationContext(state, source, sa.getDescription());
          const compiled = sa.compileInteractionHook(ctx, hooks.length);
          if (compiled) {
            hooks.push(compiled);
          }
        }
      }
    }

    return hooks;
  }

  private matchesFilter(
    card: CardInstance,
    filter: CardFilter,
    source: CardInstance,
    state: GameState,
  ): boolean {
    if (card.zone === 'BATTLEFIELD' && card.phasedOut) return false;
    if (filter.types && !filter.types.some(type => getEffectiveTypes(card).includes(type))) return false;
    if (filter.subtypes && !filter.subtypes.some(subtype => getEffectiveSubtypes(card).includes(subtype))) return false;
    if (filter.supertypes && !filter.supertypes.some(supertype => getEffectiveSupertypes(card).includes(supertype))) return false;
    if (filter.colors && !filter.colors.some(color => card.definition.colorIdentity.includes(color))) return false;
    if (filter.controller === 'you' && card.controller !== source.controller) return false;
    if (filter.controller === 'opponent' && card.controller === source.controller) return false;
    if (filter.name && card.definition.name !== filter.name) return false;
    if (filter.tapped === true && !card.tapped) return false;
    if (filter.tapped === false && card.tapped) return false;
    if (filter.isToken === true && !card.isToken) return false;
    if (filter.self && (card.objectId !== source.objectId || card.zoneChangeCounter !== source.zoneChangeCounter)) return false;
    if (filter.power) {
      const power = card.modifiedPower ?? card.definition.power ?? 0;
      if (filter.power.op === 'lte' && power > filter.power.value) return false;
      if (filter.power.op === 'gte' && power < filter.power.value) return false;
      if (filter.power.op === 'eq' && power !== filter.power.value) return false;
    }
    if (filter.toughness) {
      const toughness = card.modifiedToughness ?? card.definition.toughness ?? 0;
      if (filter.toughness.op === 'lte' && toughness > filter.toughness.value) return false;
      if (filter.toughness.op === 'gte' && toughness < filter.toughness.value) return false;
      if (filter.toughness.op === 'eq' && toughness !== filter.toughness.value) return false;
    }
    if (filter.custom && !filter.custom(card, state)) return false;
    return true;
  }

  private sortEffects(effects: ContinuousEffect[]): ContinuousEffect[] {
    // Sort by layer first, then resolve dependencies, then timestamp
    return [...effects].sort((a, b) => {
      // Different layers: sort by layer number
      if (a.layer !== b.layer) return a.layer - b.layer;

      // Same layer: check dependencies
      if (a.dependsOn?.includes(b.id)) return 1; // a depends on b, b goes first
      if (b.dependsOn?.includes(a.id)) return -1; // b depends on a, a goes first

      // Same layer, no dependency: sort by timestamp
      return a.timestamp - b.timestamp;
    });
  }

  private getAffectedPermanents(effect: ContinuousEffect, state: GameState): CardInstance[] {
    const all: CardInstance[] = [];
    for (const pid of state.turnOrder) {
      for (const card of state.zones[pid].BATTLEFIELD) {
        if (effect.appliesTo(card, state)) {
          all.push(card);
        }
      }
    }
    return all;
  }

  private isExpired(effect: ContinuousEffect, state: GameState): boolean {
    switch (effect.duration.type) {
      case 'static': {
        // Expires when source leaves the battlefield
        let found = false;
        for (const pid of state.turnOrder) {
          if (state.zones[pid].BATTLEFIELD.some(c => c.objectId === effect.sourceId)) {
            found = true;
            break;
          }
        }
        return !found;
      }

      case 'until-end-of-turn':
        // Removed during cleanup step (handled by TurnManager)
        return false;

      case 'permanent':
        return false;

      case 'while-condition':
        return !effect.duration.check(state);
    }
  }
}

