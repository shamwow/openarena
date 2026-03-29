import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ThrivingIsle = CardBuilder.create('Thriving Isle')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      // TODO: Track chosen color from ETB. Simplified: tap for U or any other color.
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['U', 'W', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['U', 'W', 'B', 'R', 'G'] }],
      description: '{T}: Add {U} or one mana of the chosen color.',
    },
  )
  .build();
