import type { TriggeredAbilityDef } from '../engine/types';

export function createFirebendingTriggeredAbility(amount = 1): TriggeredAbilityDef {
  return {
    kind: 'triggered',
    trigger: { on: 'attacks', filter: { self: true } },
    effect: (ctx) => {
      ctx.game.addMana(ctx.controller, 'R', amount);
    },
    manaProduction: [{ amount, colors: ['R'] }],
    isManaAbility: true,
    optional: false,
    description: `Firebending ${amount}`,
  };
}
