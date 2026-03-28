import type {
  AbilityDefinition,
  CardDefinition,
  CardInstance,
  GameState,
  Keyword as KeywordValue,
  StaticAbilityDef,
  StaticEffectDef,
  Zone,
} from './types';
import { Keyword } from './types';
import { getEffectiveAbilities } from './GameState';

type AbilitySource = CardDefinition | CardInstance;

export interface TimingPermissionProfile {
  canCastAsInstant: boolean;
  canActivateAsInstant: boolean;
}

export interface AttackRuleProfile {
  canAttack: boolean;
  ignoreSummoningSickness: boolean;
  attacksWithoutTapping: boolean;
}

export interface ActivationRuleProfile {
  ignoreTapSummoningSickness: boolean;
}

export interface BlockRuleProfile {
  canBlock: boolean;
  canBeBlocked: boolean;
  minBlockers: number;
  hasFlying: boolean;
  canBlockFlying: boolean;
  landwalkSubtypes: string[];
}

export interface CombatDamageRuleProfile {
  hasFirstStrike: boolean;
  hasDoubleStrike: boolean;
  lethalDamageIsOne: boolean;
  marksDeathtouchDamage: boolean;
  excessToDefender: boolean;
  controllerGainsLifeFromDamage: boolean;
}

export interface SurvivalRuleProfile {
  ignoreDestroy: boolean;
  ignoreLethalDamage: boolean;
}

export interface PhaseRuleProfile {
  phasesInDuringUntap: boolean;
  phasesOutDuringUntap: boolean;
}

export function getPrimitiveAbilitiesForKeyword(keyword: KeywordValue): AbilityDefinition[] {
  switch (keyword) {
    case Keyword.HEXPROOF:
      return [makeStaticAbility({
        type: 'interaction-hook',
        hook: {
          type: 'forbid',
          interactions: ['target'],
          phases: ['candidate', 'revalidate'],
          filter: { self: true },
          source: { controller: 'opponents' },
          reason: 'hexproof',
        },
      }, 'Hexproof')];

    case Keyword.SHROUD:
      return [makeStaticAbility({
        type: 'interaction-hook',
        hook: {
          type: 'forbid',
          interactions: ['target'],
          phases: ['candidate', 'revalidate'],
          filter: { self: true },
          reason: 'shroud',
        },
      }, 'Shroud')];

    case Keyword.FLASH:
      return [makeStaticAbility({
        type: 'timing-permission',
        scope: 'spell',
        anyTimeCouldCastInstant: true,
      }, 'Flash')];

    case Keyword.HASTE:
      return [
        makeStaticAbility({
          type: 'attack-rule',
          ignoreSummoningSickness: true,
        }, 'Haste'),
        makeStaticAbility({
          type: 'activation-rule',
          ignoreTapSummoningSickness: true,
        }, 'Haste'),
      ];

    case Keyword.VIGILANCE:
      return [makeStaticAbility({
        type: 'attack-rule',
        attacksWithoutTapping: true,
      }, 'Vigilance')];

    case Keyword.DEFENDER:
      return [makeStaticAbility({
        type: 'attack-rule',
        canAttack: false,
      }, 'Defender')];

    case Keyword.FLYING:
      return [makeStaticAbility({
        type: 'block-rule',
        evasion: 'requires-flying-or-reach',
      }, 'Flying')];

    case Keyword.REACH:
      return [makeStaticAbility({
        type: 'block-rule',
        canBlockIfAttackerHas: 'flying',
      }, 'Reach')];

    case Keyword.MENACE:
      return [makeStaticAbility({
        type: 'block-rule',
        minBlockers: 2,
      }, 'Menace')];

    case Keyword.UNBLOCKABLE:
      return [makeStaticAbility({
        type: 'block-rule',
        canBeBlocked: false,
      }, 'Unblockable')];

    case Keyword.PLAINSWALK:
      return [makeStaticAbility({
        type: 'block-rule',
        landwalkSubtypes: ['Plains'],
      }, 'Plainswalk')];

    case Keyword.ISLANDWALK:
      return [makeStaticAbility({
        type: 'block-rule',
        landwalkSubtypes: ['Island'],
      }, 'Islandwalk')];

    case Keyword.SWAMPWALK:
      return [makeStaticAbility({
        type: 'block-rule',
        landwalkSubtypes: ['Swamp'],
      }, 'Swampwalk')];

    case Keyword.MOUNTAINWALK:
      return [makeStaticAbility({
        type: 'block-rule',
        landwalkSubtypes: ['Mountain'],
      }, 'Mountainwalk')];

    case Keyword.FORESTWALK:
      return [makeStaticAbility({
        type: 'block-rule',
        landwalkSubtypes: ['Forest'],
      }, 'Forestwalk')];

    case Keyword.FIRST_STRIKE:
      return [makeStaticAbility({
        type: 'combat-damage-rule',
        combatDamageStep: 'first-strike',
      }, 'First Strike')];

    case Keyword.DOUBLE_STRIKE:
      return [makeStaticAbility({
        type: 'combat-damage-rule',
        combatDamageStep: 'double-strike',
      }, 'Double Strike')];

    case Keyword.DEATHTOUCH:
      return [makeStaticAbility({
        type: 'combat-damage-rule',
        lethalDamageIsOne: true,
        marksDeathtouchDamage: true,
      }, 'Deathtouch')];

    case Keyword.TRAMPLE:
      return [makeStaticAbility({
        type: 'combat-damage-rule',
        excessToDefender: true,
      }, 'Trample')];

    case Keyword.LIFELINK:
      return [makeStaticAbility({
        type: 'combat-damage-rule',
        controllerGainsLifeFromDamage: true,
      }, 'Lifelink')];

    case Keyword.INDESTRUCTIBLE:
      return [makeStaticAbility({
        type: 'survival-rule',
        ignoreDestroy: true,
        ignoreLethalDamage: true,
      }, 'Indestructible')];

    case Keyword.PHASING:
      return [makeStaticAbility({
        type: 'phase-rule',
        phasesInDuringUntap: true,
        phasesOutDuringUntap: true,
      }, 'Phasing')];

    default:
      return [];
  }
}

export function getTimingPermissionProfile(
  source: AbilitySource,
  state?: GameState,
  zone?: Zone,
): TimingPermissionProfile {
  const profile: TimingPermissionProfile = {
    canCastAsInstant: hasKeyword(source, Keyword.FLASH),
    canActivateAsInstant: false,
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'timing-permission') continue;
    if (zone && effect.zones?.length && !effect.zones.includes(zone)) continue;
    if (!effect.anyTimeCouldCastInstant) continue;

    if (effect.scope === 'spell' || effect.scope === 'all') {
      profile.canCastAsInstant = true;
    }
    if (effect.scope === 'activated-ability' || effect.scope === 'all') {
      profile.canActivateAsInstant = true;
    }
  }

  return profile;
}

export function getAttackRuleProfile(
  source: AbilitySource,
  state?: GameState,
): AttackRuleProfile {
  const profile: AttackRuleProfile = {
    canAttack: !hasKeyword(source, Keyword.DEFENDER),
    ignoreSummoningSickness: hasKeyword(source, Keyword.HASTE),
    attacksWithoutTapping: hasKeyword(source, Keyword.VIGILANCE),
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'attack-rule') continue;
    if (effect.canAttack === false) {
      profile.canAttack = false;
    }
    if (effect.ignoreSummoningSickness) {
      profile.ignoreSummoningSickness = true;
    }
    if (effect.attacksWithoutTapping) {
      profile.attacksWithoutTapping = true;
    }
  }

  return profile;
}

export function getActivationRuleProfile(
  source: AbilitySource,
  state?: GameState,
): ActivationRuleProfile {
  const profile: ActivationRuleProfile = {
    ignoreTapSummoningSickness: hasKeyword(source, Keyword.HASTE),
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'activation-rule') continue;
    if (effect.ignoreTapSummoningSickness) {
      profile.ignoreTapSummoningSickness = true;
    }
  }

  return profile;
}

export function getBlockRuleProfile(
  source: AbilitySource,
  state?: GameState,
): BlockRuleProfile {
  const landwalkSubtypes = new Set<string>();
  if (hasKeyword(source, Keyword.PLAINSWALK)) landwalkSubtypes.add('Plains');
  if (hasKeyword(source, Keyword.ISLANDWALK)) landwalkSubtypes.add('Island');
  if (hasKeyword(source, Keyword.SWAMPWALK)) landwalkSubtypes.add('Swamp');
  if (hasKeyword(source, Keyword.MOUNTAINWALK)) landwalkSubtypes.add('Mountain');
  if (hasKeyword(source, Keyword.FORESTWALK)) landwalkSubtypes.add('Forest');

  const profile: BlockRuleProfile = {
    canBlock: true,
    canBeBlocked: !hasKeyword(source, Keyword.UNBLOCKABLE),
    minBlockers: hasKeyword(source, Keyword.MENACE) ? 2 : 1,
    hasFlying: hasKeyword(source, Keyword.FLYING),
    canBlockFlying: hasKeyword(source, Keyword.FLYING) || hasKeyword(source, Keyword.REACH),
    landwalkSubtypes: [...landwalkSubtypes],
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'block-rule') continue;
    if (effect.canBlock === false) {
      profile.canBlock = false;
    }
    if (effect.canBeBlocked === false) {
      profile.canBeBlocked = false;
    }
    if (effect.minBlockers !== undefined) {
      profile.minBlockers = Math.max(profile.minBlockers, effect.minBlockers);
    }
    if (effect.evasion === 'requires-flying-or-reach') {
      profile.hasFlying = true;
      profile.canBlockFlying = true;
    }
    if (effect.canBlockIfAttackerHas === 'flying') {
      profile.canBlockFlying = true;
    }
    for (const subtype of effect.landwalkSubtypes ?? []) {
      landwalkSubtypes.add(subtype);
    }
  }

  profile.landwalkSubtypes = [...landwalkSubtypes];
  return profile;
}

export function getCombatDamageRuleProfile(
  source: AbilitySource,
  state?: GameState,
): CombatDamageRuleProfile {
  const profile: CombatDamageRuleProfile = {
    hasFirstStrike: hasKeyword(source, Keyword.FIRST_STRIKE) || hasKeyword(source, Keyword.DOUBLE_STRIKE),
    hasDoubleStrike: hasKeyword(source, Keyword.DOUBLE_STRIKE),
    lethalDamageIsOne: hasKeyword(source, Keyword.DEATHTOUCH),
    marksDeathtouchDamage: hasKeyword(source, Keyword.DEATHTOUCH),
    excessToDefender: hasKeyword(source, Keyword.TRAMPLE),
    controllerGainsLifeFromDamage: hasKeyword(source, Keyword.LIFELINK),
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'combat-damage-rule') continue;
    if (effect.combatDamageStep === 'first-strike') {
      profile.hasFirstStrike = true;
    }
    if (effect.combatDamageStep === 'double-strike') {
      profile.hasFirstStrike = true;
      profile.hasDoubleStrike = true;
    }
    if (effect.lethalDamageIsOne) {
      profile.lethalDamageIsOne = true;
    }
    if (effect.marksDeathtouchDamage) {
      profile.marksDeathtouchDamage = true;
    }
    if (effect.excessToDefender) {
      profile.excessToDefender = true;
    }
    if (effect.controllerGainsLifeFromDamage) {
      profile.controllerGainsLifeFromDamage = true;
    }
  }

  return profile;
}

export function getSurvivalRuleProfile(
  source: AbilitySource,
  state?: GameState,
): SurvivalRuleProfile {
  const profile: SurvivalRuleProfile = {
    ignoreDestroy: hasKeyword(source, Keyword.INDESTRUCTIBLE),
    ignoreLethalDamage: hasKeyword(source, Keyword.INDESTRUCTIBLE),
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'survival-rule') continue;
    if (effect.ignoreDestroy) {
      profile.ignoreDestroy = true;
    }
    if (effect.ignoreLethalDamage) {
      profile.ignoreLethalDamage = true;
    }
  }

  return profile;
}

export function getPhaseRuleProfile(
  source: AbilitySource,
  state?: GameState,
): PhaseRuleProfile {
  const profile: PhaseRuleProfile = {
    phasesInDuringUntap: hasKeyword(source, Keyword.PHASING),
    phasesOutDuringUntap: hasKeyword(source, Keyword.PHASING),
  };

  for (const effect of getStaticEffects(source, state)) {
    if (effect.type !== 'phase-rule') continue;
    if (effect.phasesInDuringUntap) {
      profile.phasesInDuringUntap = true;
    }
    if (effect.phasesOutDuringUntap) {
      profile.phasesOutDuringUntap = true;
    }
  }

  return profile;
}

function hasKeyword(source: AbilitySource, keyword: KeywordValue): boolean {
  if (isCardInstance(source)) {
    return (source.modifiedKeywords ?? source.definition.keywords).includes(keyword);
  }
  return source.keywords.includes(keyword);
}

function getStaticEffects(source: AbilitySource, state?: GameState): StaticEffectDef[] {
  const abilities = isCardInstance(source) ? getEffectiveAbilities(source) : source.abilities;
  return abilities.flatMap((ability) => {
    if (ability.kind !== 'static') return [];
    if (isCardInstance(source) && state && ability.condition && !ability.condition(state, source)) {
      return [];
    }
    return [ability.effect];
  });
}

function isCardInstance(source: AbilitySource): source is CardInstance {
  return 'zone' in source;
}

function makeStaticAbility(effect: StaticEffectDef, description: string): StaticAbilityDef {
  return {
    kind: 'static',
    effect,
    description,
  };
}
