import type {
  CardDefinition, CardType, ManaColor, Keyword,
  AbilityDefinition, ActivatedAbilityDef, TriggeredAbilityDef,
  StaticAbilityDef, SpellAbilityDef, Cost, TriggerCondition,
  EffectFn, TargetSpec, StaticEffectDef,
} from '../engine/types';
import { parseManaCost, emptyManaCost } from '../engine/types';

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
      oracleText: '',
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
    this.def.oracleText = text;
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
      description: `{T}: Add {${color}}.`,
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Add a tap-for-any-color ability */
  tapForAnyColor(): this {
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost: { tap: true },
      effect: async (ctx) => {
        const color = await ctx.choices.chooseOne(
          'Choose a color of mana to add',
          ['W', 'U', 'B', 'R', 'G'] as (keyof import('../engine/types').ManaPool)[],
          (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' }[c] ?? c)
        );
        ctx.game.addMana(ctx.controller, color, 1);
      },
      timing: 'instant',
      isManaAbility: true,
      description: '{T}: Add one mana of any color.',
    };
    this.def.abilities.push(ability);
    return this;
  }

  /** Add a generic activated ability */
  activated(
    cost: Cost,
    effect: EffectFn,
    opts?: { timing?: 'instant' | 'sorcery'; isManaAbility?: boolean; targets?: TargetSpec[]; description?: string }
  ): this {
    const ability: ActivatedAbilityDef = {
      kind: 'activated',
      cost,
      effect,
      targets: opts?.targets,
      timing: opts?.timing ?? 'instant',
      isManaAbility: opts?.isManaAbility ?? false,
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
      oracleText: this.def.oracleText ?? '',
      abilities: this.def.abilities,
      keywords: this.def.keywords,
    };
  }

  private deriveColorIdentity(): void {
    const cost = this.def.manaCost!;
    const colors: ManaColor[] = [];
    if (cost.W > 0) colors.push('W' as ManaColor);
    if (cost.U > 0) colors.push('U' as ManaColor);
    if (cost.B > 0) colors.push('B' as ManaColor);
    if (cost.R > 0) colors.push('R' as ManaColor);
    if (cost.G > 0) colors.push('G' as ManaColor);
    this.def.colorIdentity = colors;
  }
}
