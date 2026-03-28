import type { CardInstance, LastKnownInformation } from '../types/cards';
import type { PlayerId } from '../types/core';
import type { EffectFn } from '../types/effects';
import type { GameEvent } from '../types/events';
import type { CardFilter, SpellFilter } from '../types/filters';
import type { ManaProduction } from '../types/mana';
import type { GameState } from '../types/state';
import type { TargetSpec } from '../types/targeting';
import type { TriggeredAbilityDef, TriggerCondition } from '../types/abilities';
import { CardType } from '../types/core';
import {
  findCard,
  getEffectiveSubtypes,
  getEffectiveSupertypes,
  hasType,
  getLastKnownInformation,
} from '../GameState';

export class TriggeredAbility {
  readonly kind = 'triggered' as const;
  private _trigger: TriggerCondition;
  private _effect: EffectFn;
  private _manaProduction: ManaProduction[] | undefined;
  private _targets: TargetSpec[] | undefined;
  private _interveningIf: ((game: GameState, source: CardInstance, event: GameEvent) => boolean) | undefined;
  private _isManaAbility: boolean;
  private _oncePerTurn: boolean;
  private _optional: boolean;
  private _description: string;

  private constructor() {
    this._isManaAbility = false;
    this._oncePerTurn = false;
    this._optional = false;
    this._description = '';
    this._trigger = { on: 'custom', match: () => false };
    this._effect = () => {};
  }

  static from(def: TriggeredAbilityDef): TriggeredAbility {
    const t = new TriggeredAbility();
    t._trigger = def.trigger;
    t._effect = def.effect;
    t._manaProduction = def.manaProduction;
    t._targets = def.targets;
    t._interveningIf = def.interveningIf;
    t._isManaAbility = def.isManaAbility ?? false;
    t._oncePerTurn = def.oncePerTurn ?? false;
    t._optional = def.optional;
    t._description = def.description;
    return t;
  }

  /**
   * Full trigger match: checks trigger condition + intervening-if.
   */
  matches(event: GameEvent, source: CardInstance, state: GameState): boolean {
    if (!this.matchesTriggerCondition(event, source, state)) return false;
    if (this._interveningIf && !this._interveningIf(state, source, event)) return false;
    return true;
  }

  /**
   * Check just the trigger condition (without intervening-if).
   */
  matchesTriggerCondition(event: GameEvent, source: CardInstance, state: GameState): boolean {
    const trigger = this._trigger;
    switch (trigger.on) {
      case 'enter-battlefield':
        if (event.type !== 'ENTERS_BATTLEFIELD') return false;
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'leave-battlefield':
        if (event.type !== 'LEAVES_BATTLEFIELD') return false;
        if (trigger.destination && event.destination !== trigger.destination) return false;
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'cast-spell':
        if (event.type !== 'SPELL_CAST') return false;
        return matchesSpellFilter(trigger.filter, event, source, state);

      case 'dies':
        if (event.type !== 'ZONE_CHANGE') return false;
        if (event.fromZone !== 'BATTLEFIELD' || event.toZone !== 'GRAVEYARD') return false;
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'attacks':
        if (event.type !== 'ATTACKS') return false;
        return matchesCardFilter(trigger.filter, event.attackerId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'blocks':
        if (event.type !== 'BLOCKS') return false;
        return matchesCardFilter(trigger.filter, event.blockerId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'deals-damage':
        if (event.type !== 'DAMAGE_DEALT') return false;
        if (trigger.damageType === 'combat' && !event.isCombatDamage) return false;
        if (trigger.damageType === 'noncombat' && event.isCombatDamage) return false;
        return matchesCardFilter(trigger.filter, event.sourceId!, source, state, event.sourceZoneChangeCounter, event.lastKnownInfo);

      case 'dealt-damage':
        if (event.type !== 'DAMAGE_DEALT') return false;
        return matchesCardFilter(trigger.filter, event.targetId as string, source, state, undefined, event.lastKnownInfo);

      case 'upkeep':
        if (event.type !== 'STEP_CHANGE' || event.step !== 'UPKEEP') return false;
        return matchesTurnOwner(trigger.whose, event.activePlayer, source.controller);

      case 'end-step':
        if (event.type !== 'STEP_CHANGE' || event.step !== 'END') return false;
        return matchesTurnOwner(trigger.whose, event.activePlayer, source.controller);

      case 'draw-card':
        if (event.type !== 'DREW_CARD') return false;
        return matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'gain-life':
        if (event.type !== 'LIFE_GAINED') return false;
        return matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'lose-life':
        if (event.type !== 'LIFE_LOST') return false;
        return matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'discard':
        if (event.type !== 'DISCARDED') return false;
        return matchesPlayerFilter(trigger.whose, event.player, source.controller);

      case 'landfall':
        if (event.type !== 'ZONE_CHANGE') return false;
        if (event.fromZone === 'BATTLEFIELD' || event.toZone !== 'BATTLEFIELD') return false;
        if (trigger.whose === 'opponents') {
          return matchesCardFilter(
            { types: [CardType.LAND], controller: 'opponent' }, event.objectId, source, state,
            event.newObjectZoneChangeCounter,
            findCard(state, event.objectId, event.newObjectZoneChangeCounter) ?? event.lastKnownInfo,
          );
        }
        if (trigger.whose === 'any') {
          return matchesCardFilter(
            { types: [CardType.LAND] }, event.objectId, source, state,
            event.newObjectZoneChangeCounter,
            findCard(state, event.objectId, event.newObjectZoneChangeCounter) ?? event.lastKnownInfo,
          );
        }
        return matchesCardFilter(
          { types: [CardType.LAND], controller: 'you' }, event.objectId, source, state,
          event.newObjectZoneChangeCounter,
          findCard(state, event.objectId, event.newObjectZoneChangeCounter) ?? event.lastKnownInfo,
        );

      case 'tap':
        if (event.type !== 'TAPPED') return false;
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'tap-for-mana':
        if (event.type !== 'TAPPED_FOR_MANA') return false;
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'untap':
        if (event.type !== 'UNTAPPED') return false;
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'counter-placed':
        if (event.type !== 'COUNTER_ADDED') return false;
        if (trigger.counterType && event.counterType !== trigger.counterType) return false;
        if (trigger.whose) {
          if (!event.player) return false;
          if (!matchesPlayerFilter(trigger.whose, event.player, source.controller)) return false;
        }
        return matchesCardFilter(trigger.filter, event.objectId, source, state, event.objectZoneChangeCounter, event.lastKnownInfo);

      case 'phase':
        return event.type === 'PHASE_CHANGE' && event.phase === trigger.phase;

      case 'step':
        return event.type === 'STEP_CHANGE' && event.step === trigger.step;

      case 'custom':
        return trigger.match(event, source, state);

      default:
        return false;
    }
  }

  /**
   * Check if this is a tap-for-mana trigger that matches a tapped card (for ManaManager).
   */
  matchesTapForManaTrigger(tappedCard: CardInstance, sourceController: PlayerId, state: GameState): boolean {
    if (this._trigger.on !== 'tap-for-mana') return false;
    if (!this._isManaAbility || !this._manaProduction?.length) return false;
    const filter = this._trigger.filter;
    if (!filter) return true;
    return matchesCardFilterDirect(tappedCard, filter, sourceController);
  }

  isManaAbility(): boolean { return this._isManaAbility; }
  isOncePerTurn(): boolean { return this._oncePerTurn; }
  isOptional(): boolean { return this._optional; }
  getEffect(): EffectFn { return this._effect; }
  getTargetSpecs(): TargetSpec[] | undefined { return this._targets; }
  getManaProduction(): ManaProduction[] | undefined { return this._manaProduction; }
  getDescription(): string { return this._description; }
}

// ---------------------------------------------------------------------------
// Shared filter helpers (moved from EventBus)
// ---------------------------------------------------------------------------

function matchesTurnOwner(
  whose: 'yours' | 'each' | 'opponents' | undefined,
  activePlayer: PlayerId,
  sourceController: PlayerId,
): boolean {
  if (!whose || whose === 'each') return true;
  if (whose === 'yours') return activePlayer === sourceController;
  if (whose === 'opponents') return activePlayer !== sourceController;
  return true;
}

function matchesPlayerFilter(
  whose: 'yours' | 'opponents' | 'any' | undefined,
  eventPlayer: PlayerId,
  sourceController: PlayerId,
): boolean {
  if (!whose || whose === 'any') return true;
  if (whose === 'yours') return eventPlayer === sourceController;
  if (whose === 'opponents') return eventPlayer !== sourceController;
  return true;
}

function matchesCardFilter(
  filter: CardFilter | undefined,
  objectId: string,
  source: CardInstance,
  state: GameState,
  zoneChangeCounter?: number,
  fallback?: LastKnownInformation,
): boolean {
  if (!filter) return true;

  const card = resolveCardReference(objectId, state, zoneChangeCounter, fallback);
  if (!card) return false;

  if (filter.self) {
    return card.objectId === source.objectId && card.zoneChangeCounter === source.zoneChangeCounter;
  }

  if (filter.types && !filter.types.some(t => hasType(card, t))) return false;
  if (filter.subtypes && !filter.subtypes.some(t => getEffectiveSubtypes(card).includes(t))) return false;
  if (filter.supertypes && !filter.supertypes.some(t => getEffectiveSupertypes(card).includes(t))) return false;

  if (filter.controller === 'you' && card.controller !== source.controller) return false;
  if (filter.controller === 'opponent' && card.controller === source.controller) return false;

  if (filter.name && card.definition.name !== filter.name) return false;

  if (filter.power) {
    const p = card.modifiedPower ?? card.definition.power ?? 0;
    if (!compareNum(p, filter.power.op, filter.power.value)) return false;
  }
  if (filter.toughness) {
    const t = card.modifiedToughness ?? card.definition.toughness ?? 0;
    if (!compareNum(t, filter.toughness.op, filter.toughness.value)) return false;
  }

  if (filter.tapped !== undefined && card.tapped !== filter.tapped) return false;
  if (filter.custom && !filter.custom(card, state)) return false;

  return true;
}

function matchesSpellFilter(
  filter: SpellFilter | undefined,
  event: any,
  source: CardInstance,
  state: GameState,
): boolean {
  if (!filter) return true;
  if (filter.controller === 'opponent' && event.castBy === source.controller) return false;
  if (filter.controller === 'you' && event.castBy !== source.controller) return false;
  if (filter.types && !filter.types.some((t: any) => event.spellTypes.includes(t))) return false;
  return matchesCardFilter(
    { ...filter, controller: undefined, types: undefined },
    event.objectId,
    source,
    state,
    event.objectZoneChangeCounter,
    event.lastKnownInfo,
  );
}

/** Direct card filter match (no objectId lookup — card already resolved). Used by ManaManager. */
function matchesCardFilterDirect(
  card: CardInstance,
  filter: CardFilter,
  sourceController: PlayerId,
): boolean {
  if (filter.self) return false;
  if (filter.types && !filter.types.some(t => hasType(card, t))) return false;
  if (filter.subtypes && !filter.subtypes.some(t => getEffectiveSubtypes(card).includes(t))) return false;
  if (filter.controller === 'you' && card.controller !== sourceController) return false;
  if (filter.controller === 'opponent' && card.controller === sourceController) return false;
  return true;
}

function resolveCardReference(
  objectId: string,
  state: GameState,
  zoneChangeCounter?: number,
  fallback?: LastKnownInformation,
): CardInstance | LastKnownInformation | undefined {
  return (
    findCard(state, objectId, zoneChangeCounter)
    ?? getLastKnownInformation(state, objectId, zoneChangeCounter)
    ?? fallback
  );
}

function compareNum(a: number, op: 'lte' | 'gte' | 'eq', b: number): boolean {
  switch (op) {
    case 'lte': return a <= b;
    case 'gte': return a >= b;
    case 'eq': return a === b;
  }
}
