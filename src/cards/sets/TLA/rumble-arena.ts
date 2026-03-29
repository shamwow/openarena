import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const RumbleArena = CardBuilder.create('Rumble Arena')
  .types(CardType.LAND)
  .vigilance()
  .etbEffect(async (ctx) => {
    await ctx.game.scry(ctx.controller, 1);
  }, { description: 'When this land enters, scry 1.' })
  .tapForMana('C')
  .activated(
    { mana: parseManaCost('{1}'), tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{1}, {T}: Add one mana of any color.',
    },
  )
  .build();
