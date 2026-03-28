import type {
  CardFilter,
  CardInstance,
  CompiledInteractionHook,
  ContinuousEffect,
  GameState,
  InteractionHookDef,
  ReplacementEffect,
  StaticAbilityDef,
  WouldEnterBattlefieldReplacementEffect,
} from './types';
import { CardType, GameEventType, Layer } from './types';
import { getEffectiveSubtypes, getEffectiveSupertypes, getEffectiveTypes, hasType } from './GameState';
import { matchesInteractionSource } from './InteractionEngine';
import { Cost } from './costs';

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

  private compileStaticContinuousEffects(state: GameState): ContinuousEffect[] {
    const effects: ContinuousEffect[] = [];

    for (const playerId of state.turnOrder) {
      if (state.players[playerId].hasLost) continue;
      for (const source of state.zones[playerId].BATTLEFIELD) {
        if (source.phasedOut) continue;
        const abilities = source.modifiedAbilities ?? source.definition.abilities;
        for (const ability of abilities) {
          if (ability.kind !== 'static') continue;
          if (ability.condition && !ability.condition(state, source)) continue;

          const compiled = this.compileStaticAbility(state, source, ability);
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
          if (ability.condition && !ability.condition(state, source)) continue;
          const effect = ability.effect;

          if (effect.type === 'replacement') {
            if (effect.selfReplacement || effect.replaces === 'would-enter-battlefield') {
              continue;
            }
            replacements.push({
              id: `${source.objectId}:${source.zoneChangeCounter}:replacement:${replacements.length}`,
              sourceId: source.objectId,
              isSelfReplacement: false,
              appliesTo: (event) => this.matchesReplacementEvent(effect.replaces, event.type) && (!effect.replace || Boolean(source)) && source.zone === 'BATTLEFIELD',
              replace: (event, game) => effect.replace(game, source, event),
            });
          }

          if (effect.type === 'prevention') {
            replacements.push({
              id: `${source.objectId}:${source.zoneChangeCounter}:prevention:${replacements.length}`,
              sourceId: source.objectId,
              isSelfReplacement: false,
              appliesTo: (event, game) => {
                if (event.type !== GameEventType.DAMAGE_DEALT) return false;
                if (effect.prevents === 'combat-damage' && !event.isCombatDamage) return false;
                if (effect.prevents === 'damage' || event.isCombatDamage) {
                  if (typeof event.targetId === 'string' && event.targetId.startsWith('player')) {
                    return false;
                  }
                  const target = this.findCardById(game, event.targetId as string);
                  if (!target) return false;
                  return !effect.filter || this.matchesFilter(target, effect.filter, source, game);
                }
                return false;
              },
              replace: () => null,
            });
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
          if (ability.condition && !ability.condition(state, source)) continue;
          const effect = ability.effect;
          if (effect.type !== 'replacement' || effect.replaces !== 'would-enter-battlefield' || effect.selfReplacement) {
            continue;
          }

          replacements.push({
            id: `${source.objectId}:${source.zoneChangeCounter}:would-enter:${replacements.length}`,
            sourceId: source.objectId,
            isSelfReplacement: false,
            appliesTo: () => source.zone === 'BATTLEFIELD',
            replace: (event, game) => effect.replace(game, source, event),
          });
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
          if (ability.condition && !ability.condition(state, source)) continue;

          if (ability.effect.type === 'interaction-hook') {
            hooks.push(this.compileInteractionHook(state, source, ability, ability.effect.hook, hooks.length));
          }

          if (ability.effect.type === 'cant-be-targeted') {
            hooks.push(this.compileInteractionHook(state, source, ability, {
              type: 'forbid',
              interactions: ['target'],
              phases: ['candidate', 'revalidate'],
              filter: ability.effect.filter,
              source: { controller: 'opponents' },
            }, hooks.length));
          }
        }
      }
    }

    return hooks;
  }

  private compileStaticAbility(
    state: GameState,
    source: CardInstance,
    ability: StaticAbilityDef,
  ): ContinuousEffect | null {
    const effect = ability.effect;

    switch (effect.type) {
      case 'pump':
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:pump:${ability.description}`,
          sourceId: source.objectId,
          layer: Layer.PT_MODIFY,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => this.matchesFilter(permanent, effect.filter, source, state),
          apply: permanent => {
            permanent.modifiedPower = (permanent.modifiedPower ?? permanent.definition.power ?? 0) + effect.power;
            permanent.modifiedToughness = (permanent.modifiedToughness ?? permanent.definition.toughness ?? 0) + effect.toughness;
          },
        };

      case 'attached-pump':
        if (!source.attachedTo) return null;
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:attached-pump:${ability.description}`,
          sourceId: source.objectId,
          layer: Layer.PT_MODIFY,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => permanent.objectId === source.attachedTo,
          apply: permanent => {
            const power = typeof effect.power === 'function' ? effect.power(state, source) : effect.power;
            const toughness = typeof effect.toughness === 'function' ? effect.toughness(state, source) : effect.toughness;
            permanent.modifiedPower = (permanent.modifiedPower ?? permanent.definition.power ?? 0) + power;
            permanent.modifiedToughness = (permanent.modifiedToughness ?? permanent.definition.toughness ?? 0) + toughness;
          },
        };

      case 'set-base-pt':
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:set-base-pt:${ability.description}`,
          sourceId: source.objectId,
          layer: effect.layer === 'cda' ? Layer.PT_CDA : Layer.PT_SET,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => this.matchesFilter(permanent, effect.filter, source, state),
          apply: permanent => {
            permanent.modifiedPower =
              typeof effect.power === 'function' ? effect.power(state, source) : effect.power;
            permanent.modifiedToughness =
              typeof effect.toughness === 'function' ? effect.toughness(state, source) : effect.toughness;
          },
        };

      case 'add-types':
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:add-types:${ability.description}`,
          sourceId: source.objectId,
          layer: Layer.TYPE,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => this.matchesFilter(permanent, effect.filter, source, state),
          apply: permanent => {
            const types = permanent.modifiedTypes ?? [...permanent.definition.types];
            for (const type of effect.types) {
              if (!types.includes(type)) {
                types.push(type);
              }
            }
            permanent.modifiedTypes = types;
          },
        };

      case 'grant-abilities':
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:grant-abilities:${ability.description}`,
          sourceId: source.objectId,
          layer: Layer.ABILITY,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => this.matchesFilter(permanent, effect.filter, source, state),
          apply: permanent => {
            const abilities = permanent.modifiedAbilities ?? [...permanent.definition.abilities];
            abilities.push(...effect.abilities);
            permanent.modifiedAbilities = abilities;
          },
        };

      case 'no-max-hand-size':
      case 'cant-be-targeted':
      case 'interaction-hook':
        return null;

      case 'attack-tax':
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:attack-tax:${ability.description}`,
          sourceId: source.objectId,
          layer: Layer.ABILITY,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => this.matchesFilter(permanent, effect.filter, source, state),
          apply: permanent => {
            permanent.attackTaxes ??= [];
            permanent.attackTaxes.push({
              sourceId: source.objectId,
              defender: effect.defender === 'source-controller' ? source.controller : source.controller,
              cost: Cost.from(effect.cost).toPlainCost(),
            });
          },
        };

      case 'custom':
        return {
          id: `${source.objectId}:${source.zoneChangeCounter}:custom:${ability.description}`,
          sourceId: source.objectId,
          layer: Layer.ABILITY,
          timestamp: source.timestamp,
          duration: { type: 'static', sourceId: source.objectId },
          appliesTo: permanent => permanent.objectId === source.objectId && permanent.zoneChangeCounter === source.zoneChangeCounter,
          apply: () => {
            effect.apply(state, source);
          },
        };

      default:
        return null;
    }
  }

  private compileInteractionHook(
    state: GameState,
    source: CardInstance,
    ability: StaticAbilityDef,
    hook: InteractionHookDef,
    index: number,
  ): CompiledInteractionHook {
    const id = `${source.objectId}:${source.zoneChangeCounter}:interaction:${index}:${ability.description}`;
    return {
      id,
      sourceId: source.objectId,
      appliesTo: object => this.matchesFilter(object, hook.filter, source, state),
      evaluate: (ctx) => {
        if (hook.type === 'forbid') {
          if (!hook.interactions.includes(ctx.kind)) return null;
          if (hook.phases && !hook.phases.includes(ctx.phase)) return null;
          if (!matchesInteractionSource(hook.source, ctx)) return null;
          return { kind: 'forbid', reason: hook.reason };
        }

        if (ctx.kind !== hook.interaction) return null;
        if (ctx.phase !== (hook.phase ?? 'lock')) return null;
        if (!matchesInteractionSource(hook.source, ctx)) return null;

        const scope = hook.requirementScope ?? 'object-instance';
        const requirementId = scope === 'source-and-object-instance'
          ? `${id}:${ctx.actor.objectId}:${ctx.actor.zoneChangeCounter}:${ctx.object.objectId}:${ctx.object.zoneChangeCounter}`
          : `${id}:${ctx.object.objectId}:${ctx.object.zoneChangeCounter}`;

        return {
          kind: 'require',
          requirement: {
            id: requirementId,
            prompt: hook.prompt ?? `Pay for ${ctx.object.definition.name}?`,
            cost: Cost.from(hook.cost).toPlainCost(),
            onFailure: hook.onFailure,
          },
        };
      },
    };
  }

  private matchesReplacementEvent(
    replaces: import('./types').ReplacementEventType,
    eventType: import('./types').GameEventType,
  ): boolean {
    switch (replaces) {
      case 'deal-damage':
        return eventType === GameEventType.DAMAGE_DEALT;
      case 'create-token':
        return eventType === GameEventType.TOKEN_CREATED;
      case 'place-counters':
        return eventType === GameEventType.COUNTER_ADDED;
      case 'draw-card':
        return eventType === GameEventType.DREW_CARD;
      case 'discard':
        return eventType === GameEventType.DISCARDED;
      case 'dies':
        return eventType === GameEventType.ZONE_CHANGE;
    }
    return false;
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

