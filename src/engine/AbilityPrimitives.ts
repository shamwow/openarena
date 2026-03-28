import type {
  AbilityDefinition,
  CardDefinition,
  CardInstance,
  GameState,
  StaticAbilityDef,
  StaticEffectDef,
  Zone,
} from './types';
import { getEffectiveAbilities } from './GameState';
import { StaticAbility } from './abilities';

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

export function createHexproofAbilities(): AbilityDefinition[] {
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
}

export function createShroudAbilities(): AbilityDefinition[] {
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
}

export function createFlashAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'timing-permission',
    scope: 'spell',
    anyTimeCouldCastInstant: true,
  }, 'Flash')];
}

export function createHasteAbilities(): AbilityDefinition[] {
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
}

export function createVigilanceAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'attack-rule',
    attacksWithoutTapping: true,
  }, 'Vigilance')];
}

export function createDefenderAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'attack-rule',
    canAttack: false,
  }, 'Defender')];
}

export function createFlyingAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'block-rule',
    evasion: 'requires-flying-or-reach',
  }, 'Flying')];
}

export function createReachAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'block-rule',
    canBlockIfAttackerHas: 'flying',
  }, 'Reach')];
}

export function createMenaceAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'block-rule',
    minBlockers: 2,
  }, 'Menace')];
}

export function createUnblockableAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'block-rule',
    canBeBlocked: false,
  }, 'Unblockable')];
}

export function createPlainswalkAbilities(): AbilityDefinition[] {
  return createLandwalkAbilities('Plains', 'Plainswalk');
}

export function createIslandwalkAbilities(): AbilityDefinition[] {
  return createLandwalkAbilities('Island', 'Islandwalk');
}

export function createSwampwalkAbilities(): AbilityDefinition[] {
  return createLandwalkAbilities('Swamp', 'Swampwalk');
}

export function createMountainwalkAbilities(): AbilityDefinition[] {
  return createLandwalkAbilities('Mountain', 'Mountainwalk');
}

export function createForestwalkAbilities(): AbilityDefinition[] {
  return createLandwalkAbilities('Forest', 'Forestwalk');
}

export function createFirstStrikeAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'combat-damage-rule',
    combatDamageStep: 'first-strike',
  }, 'First Strike')];
}

export function createDoubleStrikeAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'combat-damage-rule',
    combatDamageStep: 'double-strike',
  }, 'Double Strike')];
}

export function createDeathtouchAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'combat-damage-rule',
    lethalDamageIsOne: true,
    marksDeathtouchDamage: true,
  }, 'Deathtouch')];
}

export function createTrampleAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'combat-damage-rule',
    excessToDefender: true,
  }, 'Trample')];
}

export function createLifelinkAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'combat-damage-rule',
    controllerGainsLifeFromDamage: true,
  }, 'Lifelink')];
}

export function createIndestructibleAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'survival-rule',
    ignoreDestroy: true,
    ignoreLethalDamage: true,
  }, 'Indestructible')];
}

export function createPhasingAbilities(): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'phase-rule',
    phasesInDuringUntap: true,
    phasesOutDuringUntap: true,
  }, 'Phasing')];
}

export function getTimingPermissionProfile(
  source: AbilitySource,
  state?: GameState,
  zone?: Zone,
): TimingPermissionProfile {
  const profile: TimingPermissionProfile = {
    canCastAsInstant: false,
    canActivateAsInstant: false,
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToTimingProfile(profile, zone);
  }

  return profile;
}

export function getAttackRuleProfile(
  source: AbilitySource,
  state?: GameState,
): AttackRuleProfile {
  const profile: AttackRuleProfile = {
    canAttack: true,
    ignoreSummoningSickness: false,
    attacksWithoutTapping: false,
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToAttackProfile(profile);
  }

  return profile;
}

export function getActivationRuleProfile(
  source: AbilitySource,
  state?: GameState,
): ActivationRuleProfile {
  const profile: ActivationRuleProfile = {
    ignoreTapSummoningSickness: false,
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToActivationProfile(profile);
  }

  return profile;
}

export function getBlockRuleProfile(
  source: AbilitySource,
  state?: GameState,
): BlockRuleProfile {
  const profile: BlockRuleProfile = {
    canBlock: true,
    canBeBlocked: true,
    minBlockers: 1,
    hasFlying: false,
    canBlockFlying: false,
    landwalkSubtypes: [],
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToBlockProfile(profile);
  }
  return profile;
}

export function getCombatDamageRuleProfile(
  source: AbilitySource,
  state?: GameState,
): CombatDamageRuleProfile {
  const profile: CombatDamageRuleProfile = {
    hasFirstStrike: false,
    hasDoubleStrike: false,
    lethalDamageIsOne: false,
    marksDeathtouchDamage: false,
    excessToDefender: false,
    controllerGainsLifeFromDamage: false,
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToCombatDamageProfile(profile);
  }

  return profile;
}

export function getSurvivalRuleProfile(
  source: AbilitySource,
  state?: GameState,
): SurvivalRuleProfile {
  const profile: SurvivalRuleProfile = {
    ignoreDestroy: false,
    ignoreLethalDamage: false,
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToSurvivalProfile(profile);
  }

  return profile;
}

export function getPhaseRuleProfile(
  source: AbilitySource,
  state?: GameState,
): PhaseRuleProfile {
  const profile: PhaseRuleProfile = {
    phasesInDuringUntap: false,
    phasesOutDuringUntap: false,
  };

  for (const sa of getActiveStaticAbilities(source, state)) {
    sa.contributeToPhaseProfile(profile);
  }

  return profile;
}

export function hasAbilityDescription(
  source: AbilitySource,
  description: string,
  state?: GameState,
): boolean {
  const abilities = isCardInstance(source) ? getEffectiveAbilities(source) : source.abilities;
  return abilities.some((ability) => {
    if (ability.description !== description) return false;
    if (!isCardInstance(source) || !state || ability.kind !== 'static') {
      return true;
    }
    return StaticAbility.from(ability).isActive(state, source);
  });
}

function createLandwalkAbilities(subtype: string, description: string): AbilityDefinition[] {
  return [makeStaticAbility({
    type: 'block-rule',
    landwalkSubtypes: [subtype],
  }, description)];
}

function getActiveStaticAbilities(source: AbilitySource, state?: GameState): StaticAbility[] {
  const abilities = isCardInstance(source) ? getEffectiveAbilities(source) : source.abilities;
  return abilities.flatMap((ability) => {
    if (ability.kind !== 'static') return [];
    const sa = StaticAbility.from(ability);
    if (isCardInstance(source) && state && !sa.isActive(state, source)) {
      return [];
    }
    return [sa];
  });
}

export { getActiveStaticAbilities };

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
