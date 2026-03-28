import type {
  CardDefinition, CardFilter, CardType, ManaColor, Keyword,
  AbilityDefinition, ActivatedAbilityDef, TriggeredAbilityDef,
  StaticAbilityDef, SimpleSpellDef, ModalSpellDef, Cost, TriggerCondition,
  EffectFn, TargetSpec, StaticEffectDef, ManaPool, ProtectionFrom,
  AlternativeCast, AdditionalCost, Zone, ManaProduction, CardInstance,
  GameState, PlayerId,
} from '../engine/types';
import {
  parseManaCost,
  emptyManaCost,
  manaCostColorIdentity,
  CardType as CardTypeConst,
} from '../engine/types';
import { getEffectiveSubtypes, getEffectiveSupertypes, hasType } from '../engine/GameState';
import { getPrimitiveAbilitiesForKeyword } from '../engine/AbilityPrimitives';
import { createFirebendingTriggeredAbility } from './firebending';

function matchesCardFilter(
  card: CardInstance,
  filter: CardFilter,
  state: GameState,
  sourceController?: PlayerId,
): boolean {
  if (card.zone === 'BATTLEFIELD' && card.phasedOut) return false;
  if (filter.types && !filter.types.some(type => hasType(card, type))) return false;
  if (filter.subtypes && !filter.subtypes.some(subtype => getEffectiveSubtypes(card).includes(subtype))) return false;
  if (filter.supertypes && !filter.supertypes.some(supertype => getEffectiveSupertypes(card).includes(supertype))) return false;
  if (filter.colors && !filter.colors.some(color => card.definition.colorIdentity.includes(color))) return false;
  if (filter.keywords && !filter.keywords.some(keyword => (card.modifiedKeywords ?? card.definition.keywords).includes(keyword))) return false;
  if (filter.controller === 'you' && sourceController && card.controller !== sourceController) return false;
  if (filter.controller === 'opponent' && sourceController && card.controller === sourceController) return false;
  if (filter.name && card.definition.name !== filter.name) return false;
  if (filter.self === true && sourceController && card.controller !== sourceController) return false;
  if (filter.tapped === true && !card.tapped) return false;
  if (filter.tapped === false && card.tapped) return false;
  if (filter.isToken === true && !card.isToken) return false;
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

export class CardBuilder {
  private deferredAbilities: AbilityDefinition[];
  private def: Partial<CardDefinition> & {
    abilities: AbilityDefinition[];
    keywords: Keyword[];
    types: CardType[];
    supertypes: string[];
    subtypes: string[];
    colorIdentity: ManaColor[];
  };

  private constructor(name: string) {
    this.deferredAbilities = [];
    this.def = {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      manaCost: emptyManaCost(),
      colorIdentity: [],
      types: [],
      supertypes: [],
      subtypes: [],
      abilities: [],
      keywords: [],
    };
  }

  static create(name: string): CardBuilder {
    return new CardBuilder(name);
  }

  id(id: string): this {
    this.def.id = id;
    return this;
  }

  cost(manaCostStr: string): this {
    this.def.manaCost = parseManaCost(manaCostStr);
    this.deriveColorIdentity();
    return this;
  }

  colors(...colors: ManaColor[]): this {
    this.def.colorIdentity = colors;
    return this;
  }

  types(...types: CardType[]): this {
    this.def.types = types;
    return this;
  }

  supertypes(...supertypes: string[]): this {
    this.def.supertypes = supertypes;
    return this;
  }

  subtypes(...subtypes: string[]): this {
    this.def.subtypes = subtypes;
    return this;
  }

  stats(power: number, toughness: number): this {
    this.def.power = power;
    this.def.toughness = toughness;
    return this;
  }

  loyalty(n: number): this {
    this.def.loyalty = n;
    return this;
  }

  oracleText(text: string): this {
    void text;
    return this;
  }

  // --- Keywords ---

  flying(): this { return this.keyword('Flying' as Keyword); }
  trample(): this { return this.keyword('Trample' as Keyword); }
  haste(): this { return this.keyword('Haste' as Keyword); }
  vigilance(): this { return this.keyword('Vigilance' as Keyword); }
  deathtouch(): this { return this.keyword('Deathtouch' as Keyword); }
  lifelink(): this { return this.keyword('Lifelink' as Keyword); }
  flash(): this { return this.keyword('Flash' as Keyword); }
  hexproof(): this { return this.keyword('Hexproof' as Keyword); }
  shroud(): this { return this.keyword('Shroud' as Keyword); }
  indestructible(): this { return this.keyword('Indestructible' as Keyword); }
  menace(): this { return this.keyword('Menace' as Keyword); }
  defender(): this { return this.keyword('Defender' as Keyword); }
  reach(): this { return this.keyword('Reach' as Keyword); }
  firstStrike(): this { return this.keyword('First Strike' as Keyword); }
  doubleStrike(): this { return this.keyword('Double Strike' as Keyword); }

  keyword(kw: Keyword): this {
    if (this.def.keywords.includes(kw)) return this;
    this.def.keywords.push(kw);
    this.def.abilities.push(...getPrimitiveAbilitiesForKeyword(kw));
    return this;
  }

  /** Add protection from the specified qualities */
  protection(from: ProtectionFrom): this {
    this.keyword('Protection' as Keyword);
    this.staticAbility({
      type: 'interaction-hook',
      hook: {
        type: 'forbid',
        interactions: ['target'],
        phases: ['candidate', 'revalidate'],
        filter: { self: true },
        source: { qualities: from },
      },
    }, { description: 'Protection prevents targeting from matching sources.' });
    this.staticAbility({
      type: 'interaction-hook',
      hook: {
        type: 'forbid',
        interactions: ['damage', 'attach', 'block'],
        filter: { self: true },
        source: { qualities: from },
      },
    }, { description: 'Protection prevents damage, attachments, and blocking from matching sources.' });
    return this;
  }

  /** Add ward with a cost. If string, treated as mana cost (e.g. "{2}"). */
  ward(cost: Cost | string): this {
    const parsedCost = typeof cost === 'string' ? { mana: parseManaCost(cost) } : cost;
    this.keyword('Ward' as Keyword);
    this.staticAbility({
      type: 'interaction-hook',
      hook: {
        type: 'require-cost',
        interaction: 'target',
        phase: 'lock',
        filter: { self: true },
        source: { controller: 'opponents' },
        cost: parsedCost,
        prompt: `Pay ward for ${this.def.name}?`,
        onFailure: 'counter-source',
        requirementScope: 'object-instance',
      },
    }, { description: 'Ward taxes opposing targeted spells and abilities.' });
    return this;
  }

  // --- Abilities ---

  /** Add a tap-for-mana ability */
  tapForMana(color: keyof import('../engine/types').ManaPool): this {
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost: { tap: true },
      effect: (ctx) => {
        ctx.game.addMana(ctx.controller, color, 1);
      },
      timing: 'instant',
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: [color] }],
      description: `{T}: Add {${color}}.`,
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Add a tap-for-any-color ability */
  tapForAnyColor(): this {
    type ColoredMana = Exclude<keyof ManaPool, 'C'>;
    const labels: Record<ColoredMana, string> = {
      W: 'White',
      U: 'Blue',
      B: 'Black',
      R: 'Red',
      G: 'Green',
    };
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost: { tap: true },
      effect: async (ctx) => {
        const options = ctx.state.players[ctx.controller].colorIdentity.filter(
          (color): color is ColoredMana => color !== 'C'
        );
        const resolvedOptions: ColoredMana[] = options.length > 0 ? options : ['W', 'U', 'B', 'R', 'G'];
        const color = await ctx.choices.chooseOne(
          'Choose a color of mana to add',
          resolvedOptions,
          (c) => labels[c]
        );
        ctx.game.addMana(ctx.controller, color, 1);
      },
      timing: 'instant',
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'], restrictToColorIdentity: true }],
      description: '{T}: Add one mana of any color.',
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Make this permanent enter tapped. */
  entersTapped(): this {
    this.deferredAbilities.push({
      kind: 'static',
      effect: {
        type: 'replacement',
        replaces: 'would-enter-battlefield',
        selfReplacement: true,
        replace: (_game, _source, event) => {
          return {
            kind: 'enter',
            event: {
              ...event,
              entry: {
                ...event.entry,
                tapped: true,
              },
            },
          };
        },
      },
      description: `${this.def.name} enters tapped.`,
    });
    return this;
  }

  /** Make this permanent enter tapped unless you already control a permanent matching the filter. */
  entersTappedUnlessYouControl(filter: CardFilter): this {
    this.deferredAbilities.push({
      kind: 'static',
      effect: {
        type: 'replacement',
        replaces: 'would-enter-battlefield',
        selfReplacement: true,
        replace: (game, _source, event) => {
          const controlsMatch = game.zones[event.controller].BATTLEFIELD.some(card =>
            matchesCardFilter(card, filter, game, event.controller)
          );
          if (controlsMatch) {
            return { kind: 'enter', event };
          }
          return {
            kind: 'enter',
            event: {
              ...event,
              entry: {
                ...event.entry,
                tapped: true,
              },
            },
          };
        },
      },
      description: `${this.def.name} enters tapped unless you control a matching permanent.`,
    });
    return this;
  }

  /** Add a generic activated ability */
  activated(
    cost: Cost,
    effect: EffectFn,
    opts?: {
      timing?: 'instant' | 'sorcery';
      isManaAbility?: boolean;
      activationZone?: Zone;
      activateOnlyDuringYourTurn?: boolean;
      manaProduction?: ManaProduction[];
      trackedManaEffect?: import('../engine/types').TrackedManaEffect;
      isExhaust?: boolean;
      targets?: TargetSpec[];
      description?: string;
    }
  ): this {
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost,
      effect,
      targets: opts?.targets,
      timing: opts?.timing ?? 'instant',
      isManaAbility: opts?.isManaAbility ?? false,
      activationZone: opts?.activationZone,
      activateOnlyDuringYourTurn: opts?.activateOnlyDuringYourTurn ?? false,
      manaProduction: opts?.manaProduction,
      trackedManaEffect: opts?.trackedManaEffect,
      isExhaust: opts?.isExhaust ?? false,
      description: opts?.description ?? '',
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Add a triggered ability */
  triggered(
    trigger: TriggerCondition,
    effect: EffectFn,
    opts?: {
      targets?: TargetSpec[];
      optional?: boolean;
      interveningIf?: TriggeredAbilityDef['interveningIf'];
      isManaAbility?: boolean;
      oncePerTurn?: boolean;
      manaProduction?: ManaProduction[];
      description?: string;
    }
  ): this {
    const ability: TriggeredAbilityDef = {
      kind: 'triggered',
      trigger,
      effect,
      manaProduction: opts?.manaProduction,
      targets: opts?.targets,
      optional: opts?.optional ?? false,
      interveningIf: opts?.interveningIf,
      isManaAbility: opts?.isManaAbility ?? false,
      oncePerTurn: opts?.oncePerTurn ?? false,
      description: opts?.description ?? '',
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Add a static ability */
  staticAbility(effect: StaticEffectDef, opts?: { condition?: StaticAbilityDef['condition']; description?: string }): this {
    const ability: StaticAbilityDef = {
      kind: 'static',
      effect,
      condition: opts?.condition,
      description: opts?.description ?? '',
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Define the spell payload (what happens when the spell resolves). */
  spell(effect: EffectFn, opts?: { targets?: TargetSpec[]; description?: string }): this {
    const spell: SimpleSpellDef = {
      kind: 'simple',
      effect,
      targets: opts?.targets,
      description: opts?.description ?? '',
    };
    this.def.spell = spell;
    return this;
  }

  /** Backward-compatible alias for spell(...). */
  spellEffect(effect: EffectFn, opts?: { targets?: TargetSpec[]; description?: string }): this {
    return this.spell(effect, opts);
  }

  /** Add an ETB (enters-the-battlefield) triggered effect */
  etbEffect(effect: EffectFn, opts?: { targets?: TargetSpec[]; optional?: boolean; description?: string }): this {
    return this.triggered(
      { on: 'enter-battlefield', filter: { self: true } },
      effect,
      { ...opts, description: opts?.description ?? '' }
    );
  }

  /** Add a dies trigger */
  diesEffect(effect: EffectFn, opts?: { targets?: TargetSpec[]; description?: string }): this {
    return this.triggered(
      { on: 'dies', filter: { self: true } },
      effect,
      { description: opts?.description ?? '' }
    );
  }

  /** Add a planeswalker loyalty ability */
  loyaltyAbility(loyaltyCost: number, effect: EffectFn, opts?: { targets?: TargetSpec[]; description?: string }): this {
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost: {
        custom: (_game, source) => {
          const currentLoyalty = source.counters['loyalty'] ?? 0;
          if (loyaltyCost < 0 && currentLoyalty < Math.abs(loyaltyCost)) return false;
          return true;
        },
      },
      effect: (ctx) => {
        // Adjust loyalty
        const current = ctx.source.counters['loyalty'] ?? 0;
        ctx.source.counters['loyalty'] = current + loyaltyCost;
        return effect(ctx);
      },
      targets: opts?.targets,
      timing: 'sorcery',
      isManaAbility: false,
      description: opts?.description ?? `[${loyaltyCost >= 0 ? '+' : ''}${loyaltyCost}]: ability`,
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Define a modal spell payload. */
  modal(
    modes: Array<{ label: string; effect: EffectFn; targets?: TargetSpec[] }>,
    chooseCount: number,
    description?: string,
    opts?: { allowRepeatedModes?: boolean }
  ): this {
    const spell: ModalSpellDef = {
      kind: 'modal',
      modes,
      chooseCount,
      allowRepeatedModes: opts?.allowRepeatedModes ?? false,
      description: description ?? `Choose ${chooseCount} —`,
    };
    this.def.spell = spell;
    return this;
  }

  tag(tag: string): this {
    switch (tag) {
      case 'storm':
        return this.storm();
      case 'cascade':
        return this.cascade();
      case 'convoke':
        return this.convoke();
      case 'delve':
        return this.delve();
      case 'no-max-hand-size':
        return this.noMaxHandSize();
      case 'partner':
        this.ensureCommanderOptions().partner = true;
        return this;
      case 'friends-forever':
        this.ensureCommanderOptions().friendsForever = true;
        return this;
      case 'choose-a-background':
        this.ensureCommanderOptions().chooseABackground = true;
        return this;
      case 'background':
        if (!this.def.subtypes.includes('Background')) {
          this.def.subtypes.push('Background');
        }
        return this;
      case 'cycling':
      case 'overload':
        return this;
      default:
        if (tag.startsWith('partner-with:')) {
          this.ensureCommanderOptions().partnerWith = tag.slice('partner-with:'.length);
          return this;
        }
        throw new Error(`Unsupported legacy tag: ${tag}`);
    }
  }

  noMaxHandSize(): this {
    return this.staticAbility({ type: 'no-max-hand-size' }, { description: 'You have no maximum hand size.' });
  }

  waterbend(amount: number): this {
    this.ensureSpellCostMechanics().push({
      kind: 'generic-tap-substitution',
      substitution: {
        amount,
        filter: {
          types: [CardTypeConst.ARTIFACT as CardType, CardTypeConst.CREATURE as CardType],
          controller: 'you',
        },
        ignoreSummoningSickness: true,
      },
    });
    return this;
  }

  firebending(amount = 1): this {
    this.def.abilities.push(createFirebendingTriggeredAbility(amount));
    return this;
  }

  /** Add an equip activated ability (sorcery-speed, attaches to target creature). */
  equip(
    cost: Cost | string,
    opts?: { targets?: TargetSpec[]; description?: string }
  ): this {
    const manaCost: Cost = typeof cost === 'string' ? { mana: parseManaCost(cost) } : cost;
    const targetSpec: TargetSpec = opts?.targets?.[0] ?? {
      what: 'creature',
      filter: { controller: 'you' },
      count: 1,
    };
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost: manaCost,
      effect: async (ctx) => {
        const target = ctx.targets.length > 0 ? ctx.targets[0] : await ctx.chooseTarget(targetSpec);
        if (target && typeof target !== 'string') {
          ctx.game.attachPermanent(ctx.source.objectId, target.objectId);
        }
      },
      targets: [targetSpec],
      timing: 'sorcery',
      isManaAbility: false,
      description: opts?.description ?? `Equip`,
    };
    this.def.abilities.push(ability);
    this.def.attachment = { type: 'Equipment' };
    return this;
  }

  /** Set this card as an Aura with the given target specification. */
  enchant(targetSpec: TargetSpec): this {
    this.def.attachment = { type: 'Aura', target: targetSpec };
    if (!this.def.subtypes.includes('Aura')) {
      this.def.subtypes.push('Aura');
    }
    return this;
  }

  /** Create a static ability that grants an effect only to the card this is attached to.
   *  Wraps the given StaticEffectDef so its filter only matches the host permanent. */
  grantToAttached(effect: StaticEffectDef): this {
    // Wrap the effect with a custom apply that uses source.attachedTo to find the host,
    // then applies the underlying effect only to that host.
    const underlyingEffect = effect;
    const wrappedEffect: StaticEffectDef = {
      type: 'custom',
      apply: (game, source) => {
        if (!source.attachedTo) return;
        // Find the host card
        for (const pid of game.turnOrder) {
          for (const card of game.zones[pid].BATTLEFIELD) {
            if (card.objectId === source.attachedTo) {
              // Apply the underlying effect to the host
              if (underlyingEffect.type === 'pump') {
                card.modifiedPower = (card.modifiedPower ?? card.definition.power ?? 0) + underlyingEffect.power;
                card.modifiedToughness = (card.modifiedToughness ?? card.definition.toughness ?? 0) + underlyingEffect.toughness;
              } else if (underlyingEffect.type === 'grant-keyword') {
                const keywords = card.modifiedKeywords ?? [...card.definition.keywords];
                if (!keywords.includes(underlyingEffect.keyword)) {
                  keywords.push(underlyingEffect.keyword);
                }
                card.modifiedKeywords = keywords;
              } else if (underlyingEffect.type === 'cant-be-targeted' && underlyingEffect.by === 'opponents') {
                const keywords = card.modifiedKeywords ?? [...card.definition.keywords];
                if (!keywords.includes('Hexproof' as Keyword)) {
                  keywords.push('Hexproof' as Keyword);
                }
                card.modifiedKeywords = keywords;
              }
              return;
            }
          }
        }
      },
    };

    const ability: StaticAbilityDef = {
      kind: 'static',
      effect: wrappedEffect,
      description: `Grants effect to attached permanent`,
    };
    this.def.abilities.push(ability);
    return this;
  }

  // --- Alternative / Additional Costs ---

  private parseCostParam(cost: Cost | string): Cost {
    if (typeof cost === 'string') {
      return { mana: parseManaCost(cost) };
    }
    return cost;
  }

  private ensureSpellCastBehaviors() {
    if (!this.def.spellCastBehaviors) {
      this.def.spellCastBehaviors = [];
    }
    return this.def.spellCastBehaviors;
  }

  private ensureSpellCostMechanics() {
    if (!this.def.spellCostMechanics) {
      this.def.spellCostMechanics = [];
    }
    return this.def.spellCostMechanics;
  }

  private ensureCommanderOptions() {
    if (!this.def.commanderOptions) {
      this.def.commanderOptions = {};
    }
    return this.def.commanderOptions;
  }

  /** Add flashback — cast from graveyard for the given cost, then exile. */
  flashback(cost: Cost | string): this {
    const parsed = this.parseCostParam(cost);
    const altCost: AlternativeCast = {
      id: 'flashback',
      cost: parsed,
      zone: 'GRAVEYARD' as Zone,
      afterResolution: 'EXILE' as Zone,
      description: `Flashback`,
    };
    if (!this.def.alternativeCosts) {
      this.def.alternativeCosts = [];
    }
    this.def.alternativeCosts.push(altCost);
    return this;
  }

  /** Add kicker — an optional additional cost that can be paid when casting. */
  kicker(cost: Cost | string): this {
    return this.additionalCost('kicker', cost, 'Kicker', { optional: true });
  }

  additionalCost(
    id: string,
    cost: Cost | string,
    description: string,
    opts?: { optional?: boolean },
  ): this {
    const parsed = this.parseCostParam(cost);
    const addCost: AdditionalCost = {
      id,
      cost: parsed,
      optional: opts?.optional ?? false,
      description,
    };
    if (!this.def.additionalCosts) {
      this.def.additionalCosts = [];
    }
    this.def.additionalCosts.push(addCost);
    return this;
  }

  overload(cost: Cost | string): this {
    const parsed = this.parseCostParam(cost);
    const altCost: AlternativeCast = {
      id: 'overload',
      cost: parsed,
      zone: 'HAND' as Zone,
      description: 'Overload',
    };
    if (!this.def.alternativeCosts) {
      this.def.alternativeCosts = [];
    }
    this.def.alternativeCosts.push(altCost);
    return this;
  }

  cascade(): this {
    this.ensureSpellCastBehaviors().push({ kind: 'cascade' });
    return this;
  }

  storm(): this {
    this.ensureSpellCastBehaviors().push({ kind: 'storm' });
    return this;
  }

  cycling(cost: Cost | string): this {
    const parsed = this.parseCostParam(cost);
    return this.activated(
      parsed,
      (ctx) => {
        ctx.game.moveCard(ctx.source.objectId, 'GRAVEYARD', ctx.source.owner);
        ctx.game.drawCards(ctx.controller, 1);
      },
      {
        timing: 'instant',
        activationZone: 'HAND',
        description: 'Cycling',
      },
    );
  }

  affinity(filter: import('../engine/types').CardFilter, description = 'Affinity'): this {
    if (!this.def.castCostAdjustments) {
      this.def.castCostAdjustments = [];
    }
    this.def.castCostAdjustments.push({
      kind: 'affinity',
      amount: 1,
      filter,
      description,
    });
    return this;
  }

  landfall(effect: EffectFn, opts?: { optional?: boolean; description?: string }): this {
    return this.triggered(
      { on: 'landfall', whose: 'yours' },
      effect,
      {
        optional: opts?.optional ?? false,
        description: opts?.description ?? 'Landfall',
      },
    );
  }

  /** Add escape — cast from graveyard for the given cost plus exiling N other cards from your graveyard. */
  escape(cost: Cost | string, exileCount: number): this {
    const parsed = this.parseCostParam(cost);
    // Merge the exile-from-graveyard requirement into the cost
    const escapeCost: Cost = {
      ...parsed,
      exileFromGraveyard: exileCount,
    };
    const altCost: AlternativeCast = {
      id: 'escape',
      cost: escapeCost,
      zone: 'GRAVEYARD' as Zone,
      description: `Escape`,
    };
    if (!this.def.alternativeCosts) {
      this.def.alternativeCosts = [];
    }
    this.def.alternativeCosts.push(altCost);
    return this;
  }

  /** Add the convoke tag — creatures you control can tap to help pay for this spell. */
  convoke(): this {
    this.ensureSpellCostMechanics().push({ kind: 'convoke' });
    return this;
  }

  /** Add the delve tag — exile cards from your graveyard to pay generic mana. */
  delve(): this {
    this.ensureSpellCostMechanics().push({ kind: 'delve' });
    return this;
  }

  // --- Transform / DFC ---

  /** Set the back face of a transforming double-faced card (e.g. Werewolves) */
  transform(backFace: CardDefinition): this {
    this.def.backFace = backFace;
    return this;
  }

  /** Set the back face of a modal double-faced card (e.g. Pathways, Zendikar MDFCs) */
  mdfc(backFace: CardDefinition): this {
    this.def.backFace = backFace;
    this.def.isMDFC = true;
    return this;
  }

  // --- Split Cards ---

  /** Set the right half of a split card (e.g. Commit // Memory). The current builder defines the left half. */
  split(rightHalf: CardDefinition, opts?: { fuse?: boolean }): this {
    this.def.splitHalf = rightHalf;
    if (opts?.fuse) {
      this.def.hasFuse = true;
    }
    return this;
  }

  // --- Sagas ---

  /** Define saga chapters. Automatically sets ENCHANTMENT type. */
  saga(chapters: Array<{ chapter: number; effect: EffectFn }>): this {
    this.def.sagaChapters = chapters;
    if (!this.def.types.includes(CardTypeConst.ENCHANTMENT as CardType)) {
      this.def.types.push(CardTypeConst.ENCHANTMENT as CardType);
    }
    return this;
  }

  // --- Adventures ---

  /** Add an adventure to this card */
  adventure(name: string, cost: string, adventureTypes: CardType[], effect: EffectFn): this {
    this.def.adventure = {
      name,
      manaCost: parseManaCost(cost),
      types: adventureTypes,
      effect,
    };
    return this;
  }

  // --- Morph ---

  /** Add morph cost to this card */
  morph(cost: Cost | string): this {
    this.def.morphCost = this.parseCostParam(cost);
    return this;
  }

  // --- Suspend ---

  /** Add suspend — exile with time counters, cast for free when last counter removed */
  suspend(timeCounters: number, cost: Cost | string): this {
    this.def.suspend = {
      cost: this.parseCostParam(cost),
      timeCounters,
    };
    return this;
  }

  // --- Build ---

  build(): CardDefinition {
    if (!this.def.id || !this.def.name) {
      throw new Error('Card must have an id and name');
    }
    if (this.def.types.length === 0) {
      throw new Error(`Card "${this.def.name}" must have at least one type`);
    }

    return {
      id: this.def.id,
      name: this.def.name,
      manaCost: this.def.manaCost!,
      colorIdentity: this.def.colorIdentity,
      commanderOptions: this.def.commanderOptions,
      types: this.def.types,
      supertypes: this.def.supertypes,
      subtypes: this.def.subtypes,
      power: this.def.power,
      toughness: this.def.toughness,
      loyalty: this.def.loyalty,
      spell: this.def.spell,
      spellCastBehaviors: this.def.spellCastBehaviors,
      spellCostMechanics: this.def.spellCostMechanics,
      abilities: [...this.def.abilities, ...this.deferredAbilities],
      keywords: this.def.keywords,
      attachment: this.def.attachment,
      alternativeCosts: this.def.alternativeCosts,
      additionalCosts: this.def.additionalCosts,
      castCostAdjustments: this.def.castCostAdjustments,
      backFace: this.def.backFace,
      isMDFC: this.def.isMDFC,
      splitHalf: this.def.splitHalf,
      hasFuse: this.def.hasFuse,
      sagaChapters: this.def.sagaChapters,
      adventure: this.def.adventure,
      morphCost: this.def.morphCost,
      suspend: this.def.suspend,
    };
  }

  private deriveColorIdentity(): void {
    const cost = this.def.manaCost!;
    this.def.colorIdentity = manaCostColorIdentity(cost);
  }
}
