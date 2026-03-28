import type {
  CardInstance,
  GameState,
  InteractionContext,
  InteractionRequirement,
  InteractionSourceMatcher,
  InteractionVerdict,
  PlayerId,
  TargetSpec,
} from './types';
import { Keyword } from './types';
import { hasType } from './GameState';

export class InteractionEngine {
  canChooseTarget(
    state: GameState,
    actor: CardInstance,
    actorController: PlayerId,
    object: CardInstance,
    spec?: TargetSpec,
  ): boolean {
    return !this.hasForbiddenVerdict(this.evaluate(state, {
      state,
      actor,
      actorController,
      object,
      kind: 'target',
      phase: 'candidate',
      spec,
    }));
  }

  collectTargetRequirements(
    state: GameState,
    actor: CardInstance,
    actorController: PlayerId,
    objects: CardInstance[],
    spec?: TargetSpec,
  ): InteractionRequirement[] {
    const requirements: InteractionRequirement[] = [];
    const seen = new Set<string>();

    for (const object of objects) {
      const verdicts = this.evaluate(state, {
        state,
        actor,
        actorController,
        object,
        kind: 'target',
        phase: 'lock',
        spec,
      });

      for (const verdict of verdicts) {
        if (verdict.kind !== 'require') continue;
        if (seen.has(verdict.requirement.id)) continue;
        seen.add(verdict.requirement.id);
        requirements.push(verdict.requirement);
      }
    }

    return requirements;
  }

  isTargetStillLegal(
    state: GameState,
    actor: CardInstance,
    actorController: PlayerId,
    object: CardInstance,
    spec?: TargetSpec,
  ): boolean {
    return !this.hasForbiddenVerdict(this.evaluate(state, {
      state,
      actor,
      actorController,
      object,
      kind: 'target',
      phase: 'revalidate',
      spec,
    }));
  }

  preventsDamage(
    state: GameState,
    actor: CardInstance,
    object: CardInstance,
    isCombatDamage: boolean,
  ): boolean {
    return this.hasForbiddenVerdict(this.evaluate(state, {
      state,
      actor,
      actorController: actor.controller,
      object,
      kind: 'damage',
      phase: 'revalidate',
      isCombatDamage,
    }));
  }

  preventsAttachment(
    state: GameState,
    attachment: CardInstance,
    host: CardInstance,
  ): boolean {
    return this.hasForbiddenVerdict(this.evaluate(state, {
      state,
      actor: attachment,
      actorController: attachment.controller,
      object: host,
      kind: 'attach',
      phase: 'revalidate',
    }));
  }

  preventsBlocking(
    state: GameState,
    blocker: CardInstance,
    attacker: CardInstance,
  ): boolean {
    return this.hasForbiddenVerdict(this.evaluate(state, {
      state,
      actor: blocker,
      actorController: blocker.controller,
      object: attacker,
      kind: 'block',
      phase: 'revalidate',
    }));
  }

  private evaluate(state: GameState, ctx: InteractionContext) {
    const verdicts: InteractionVerdict[] = [...this.getKeywordVerdicts(ctx)];

    for (const hook of state.interactionHooks) {
      if (!hook.appliesTo(ctx.object, state)) continue;
      const verdict = hook.evaluate(ctx);
      if (!verdict) continue;
      if (Array.isArray(verdict)) {
        verdicts.push(...verdict);
      } else {
        verdicts.push(verdict);
      }
    }

    return verdicts;
  }

  private getKeywordVerdicts(ctx: InteractionContext): InteractionVerdict[] {
    if (ctx.kind !== 'target') {
      return [];
    }

    if (ctx.phase !== 'candidate' && ctx.phase !== 'revalidate') {
      return [];
    }

    const keywords = ctx.object.modifiedKeywords ?? ctx.object.definition.keywords;
    if (keywords.includes(Keyword.SHROUD)) {
      return [{ kind: 'forbid' as const, reason: 'shroud' }];
    }
    if (ctx.object.controller !== ctx.actorController && keywords.includes(Keyword.HEXPROOF)) {
      return [{ kind: 'forbid' as const, reason: 'hexproof' }];
    }

    return [];
  }

  private hasForbiddenVerdict(
    verdicts: InteractionVerdict[],
  ): boolean {
    return verdicts.some(verdict => verdict.kind === 'forbid');
  }
}

export function matchesInteractionSource(
  matcher: InteractionSourceMatcher | undefined,
  ctx: InteractionContext,
): boolean {
  if (!matcher) {
    return true;
  }

  if (matcher.controller === 'same' && ctx.object.controller !== ctx.actorController) {
    return false;
  }
  if (matcher.controller === 'opponents' && ctx.object.controller === ctx.actorController) {
    return false;
  }

  if (!matcher.qualities) {
    return true;
  }

  const { colors, types, custom } = matcher.qualities;
  if (colors?.length && !colors.some(color => ctx.actor.definition.colorIdentity.includes(color))) {
    return false;
  }
  if (types?.length && !types.some(type => hasType(ctx.actor, type))) {
    return false;
  }
  if (custom && !custom(ctx.actor)) {
    return false;
  }

  return true;
}
