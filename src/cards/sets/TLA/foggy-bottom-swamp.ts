import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FoggyBottomSwamp = CardBuilder.create('Foggy Bottom Swamp')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['B', 'G'] as const,
        (c) => ({ B: 'Black', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['B', 'G'] }],
      description: '{T}: Add {B} or {G}.',
    },
  )
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
