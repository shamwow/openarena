import type {
  CardDefinition, CardType, ManaColor, Keyword,
  AbilityDefinition, ActivatedAbilityDef, TriggeredAbilityDef,
  StaticAbilityDef, SpellAbilityDef, ModalAbilityDef, Cost, TriggerCondition,
  EffectFn, TargetSpec, StaticEffectDef, ManaPool, ProtectionFrom,
  AlternativeCast, AdditionalCost, Zone, ManaCost,
} from '../engine/types';
import {
  parseManaCost,
  emptyManaCost,
  manaCostColorIdentity,
  CardType as CardTypeConst,
} from '../engine/types';

export class CardBuilder {
  private def: Partial<CardDefinition> & {
    abilities: AbilityDefinition[];
    keywords: Keyword[];
    types: CardType[];
    supertypes: string[];
    subtypes: string[];
    colorIdentity: ManaColor[];
  };

  private constructor(name: string) {
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

  oracleText(_text: string): this {
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
    if (!this.def.keywords.includes(kw)) {
      this.def.keywords.push(kw);
    }
    return this;
  }

  /** Add protection from the specified qualities */
  protection(from: ProtectionFrom): this {
    if (!this.def.protectionFrom) {
      this.def.protectionFrom = [];
    }
    this.def.protectionFrom.push(from);
    this.keyword('Protection' as Keyword);
    return this;
  }

  /** Add ward with a cost. If string, treated as mana cost (e.g. "{2}"). */
  ward(cost: Cost | string): this {
    if (typeof cost === 'string') {
      this.def.wardCost = { mana: parseManaCost(cost) };
    } else {
      this.def.wardCost = cost;
    }
    this.keyword('Ward' as Keyword);
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
    const options: ColoredMana[] = ['W', 'U', 'B', 'R', 'G'];
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
        const color = await ctx.choices.chooseOne(
          'Choose a color of mana to add',
          options,
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

  /** Add a generic activated ability */
  activated(
    cost: Cost,
    effect: EffectFn,
    opts?: {
      timing?: 'instant' | 'sorcery';
      isManaAbility?: boolean;
      activationZone?: Zone;
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
      description: opts?.description ?? '',
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Add a triggered ability */
  triggered(
    trigger: TriggerCondition,
    effect: EffectFn,
    opts?: { targets?: TargetSpec[]; optional?: boolean; interveningIf?: TriggeredAbilityDef['interveningIf']; description?: string }
  ): this {
    const ability: TriggeredAbilityDef = {
      kind: 'triggered',
      trigger,
      effect,
      targets: opts?.targets,
      optional: opts?.optional ?? false,
      interveningIf: opts?.interveningIf,
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

  /** Add the spell effect (what happens when the spell resolves) */
  spellEffect(effect: EffectFn, opts?: { targets?: TargetSpec[]; description?: string }): this {
    const ability: SpellAbilityDef = {
      kind: 'spell',
      effect,
      targets: opts?.targets,
      description: opts?.description ?? '',
    };
    this.def.abilities.push(ability);
    return this;
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

  /** Add a modal spell ability. Creates a ModalAbilityDef and adds it as the spell ability. */
  modal(
    modes: Array<{ label: string; effect: EffectFn; targets?: TargetSpec[] }>,
    chooseCount: number,
    description?: string
  ): this {
    const ability: ModalAbilityDef = {
      kind: 'modal',
      modes,
      chooseCount,
      description: description ?? `Choose ${chooseCount} —`,
    };
    this.def.abilities.push(ability);
    return this;
  }

  tag(tag: string): this {
    if (!this.def.tags) {
      this.def.tags = [];
    }
    if (!this.def.tags.includes(tag)) {
      this.def.tags.push(tag);
    }
    return this;
  }

  waterbend(amount: number): this {
    this.def.waterbend = amount;
    return this;
  }

  firebending(amount = 1): this {
    return this.triggered(
      { on: 'attacks', filter: { self: true } },
      (ctx) => {
        ctx.game.addMana(ctx.controller, 'R', amount);
      },
      { description: 'Firebending' },
    );
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
        const target = ctx.targets[0] ?? await ctx.chooseTarget(targetSpec);
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
    this.def.attachmentType = 'Equipment';
    return this;
  }

  /** Set this card as an Aura with the given target specification. */
  enchant(targetSpec: TargetSpec): this {
    this.def.attachmentType = 'Aura';
    this.def.attachTarget = targetSpec;
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
                card.cantBeTargetedByOpponents = true;
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
    const parsed = this.parseCostParam(cost);
    const addCost: AdditionalCost = {
      id: 'kicker',
      cost: parsed,
      optional: true,
      description: `Kicker`,
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
    return this.tag('overload');
  }

  cascade(): this {
    return this.tag('cascade');
  }

  storm(): this {
    return this.tag('storm');
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
    ).tag('cycling');
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
    if (!this.def.tags) {
      this.def.tags = [];
    }
    if (!this.def.tags.includes('convoke')) {
      this.def.tags.push('convoke');
    }
    return this;
  }

  /** Add the delve tag — exile cards from your graveyard to pay generic mana. */
  delve(): this {
    if (!this.def.tags) {
      this.def.tags = [];
    }
    if (!this.def.tags.includes('delve')) {
      this.def.tags.push('delve');
    }
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

  /** Define saga chapters. Automatically sets ENCHANTMENT type and totalChapters. */
  saga(chapters: Array<{ chapter: number; effect: EffectFn }>): this {
    this.def.sagaChapters = chapters;
    this.def.totalChapters = Math.max(...chapters.map(c => c.chapter));
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
    this.def.suspendCost = this.parseCostParam(cost);
    this.def.suspendTimeCounters = timeCounters;
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
      types: this.def.types,
      supertypes: this.def.supertypes,
      subtypes: this.def.subtypes,
      power: this.def.power,
      toughness: this.def.toughness,
      loyalty: this.def.loyalty,
      abilities: this.def.abilities,
      keywords: this.def.keywords,
      protectionFrom: this.def.protectionFrom,
      wardCost: this.def.wardCost,
      attachmentType: this.def.attachmentType,
      attachTarget: this.def.attachTarget,
      waterbend: this.def.waterbend,
      alternativeCosts: this.def.alternativeCosts,
      additionalCosts: this.def.additionalCosts,
      tags: this.def.tags,
      backFace: this.def.backFace,
      isMDFC: this.def.isMDFC,
      splitHalf: this.def.splitHalf,
      hasFuse: this.def.hasFuse,
      sagaChapters: this.def.sagaChapters,
      totalChapters: this.def.totalChapters,
      adventure: this.def.adventure,
      morphCost: this.def.morphCost,
      suspendCost: this.def.suspendCost,
      suspendTimeCounters: this.def.suspendTimeCounters,
    };
  }

  private deriveColorIdentity(): void {
    const cost = this.def.manaCost!;
    this.def.colorIdentity = manaCostColorIdentity(cost);
  }
}
