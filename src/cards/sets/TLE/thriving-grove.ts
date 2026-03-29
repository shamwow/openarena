import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ThrivingGrove = CardBuilder.create('Thriving Grove')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      // TODO: Track chosen color from ETB. Simplified: tap for G or any other color.
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['G', 'W', 'U', 'B', 'R'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['G', 'W', 'U', 'B', 'R'] }],
      description: '{T}: Add {G} or one mana of the chosen color.',
    },
  )
  .build();
