import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SunbakedCanyon = CardBuilder.create('Sunbaked Canyon')
  .types(CardType.LAND)
  .activated(
    { tap: true, payLife: 1 },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['R', 'W'] as const,
        (c) => ({ R: 'Red', W: 'White' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['R', 'W'] }],
      description: '{T}, Pay 1 life: Add {R} or {W}.',
    },
  )
  .activated(
    { mana: parseManaCost('{1}'), tap: true, sacrifice: { self: true } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{1}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
