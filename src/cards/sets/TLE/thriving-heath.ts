import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ThrivingHeath = CardBuilder.create('Thriving Heath')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      // TODO: Track chosen color from ETB. Simplified: tap for W or any other color.
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
      description: '{T}: Add {W} or one mana of the chosen color.',
    },
  )
  .build();
