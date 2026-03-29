import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ThrivingMoor = CardBuilder.create('Thriving Moor')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      // TODO: Track chosen color from ETB. Simplified: tap for B or any other color.
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['B', 'W', 'U', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['B', 'W', 'U', 'R', 'G'] }],
      description: '{T}: Add {B} or one mana of the chosen color.',
    },
  )
  .build();
