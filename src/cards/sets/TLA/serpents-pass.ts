import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SerpentsPass = CardBuilder.create("Serpent's Pass")
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['U', 'B'] as const,
        (c) => ({ U: 'Blue', B: 'Black' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['U', 'B'] }],
      description: '{T}: Add {U} or {B}.',
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
