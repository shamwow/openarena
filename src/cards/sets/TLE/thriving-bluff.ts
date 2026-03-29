import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ThrivingBluff = CardBuilder.create('Thriving Bluff')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      // TODO: Track chosen color from ETB. Simplified: tap for R or any other color.
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['R', 'W', 'U', 'B', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['R', 'W', 'U', 'B', 'G'] }],
      description: '{T}: Add {R} or one mana of the chosen color.',
    },
  )
  .build();
