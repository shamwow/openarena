import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SunBlessedPeak = CardBuilder.create('Sun-Blessed Peak')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
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
      description: '{T}: Add {R} or {W}.',
    },
  )
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
