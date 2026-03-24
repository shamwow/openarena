import type { GameState, ContinuousEffect, CardInstance } from './types';
import { CardType } from './types';

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

    // Sort effects by layer, then by timestamp (with dependency handling)
    const sorted = this.sortEffects(state.continuousEffects);

    // Apply effects in order
    for (const effect of sorted) {
      const affected = this.getAffectedPermanents(effect, state);
      for (const permanent of affected) {
        effect.apply(permanent, state);
      }
    }
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
        card.modifiedPower = card.definition.power;
        card.modifiedToughness = card.definition.toughness;
        card.modifiedKeywords = [...card.definition.keywords];
        card.modifiedAbilities = undefined;

        // Apply counters to P/T (these are "physical" modifiers, not continuous effects)
        if (card.definition.types.includes(CardType.CREATURE)) {
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
        const { sourceId } = effect.duration;
        let found = false;
        for (const pid of state.turnOrder) {
          if (state.zones[pid].BATTLEFIELD.some(c => c.objectId === sourceId)) {
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
