import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CompassionateHealer = CardBuilder.create('Compassionate Healer')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Cleric', 'Ally')
  .stats(2, 2)
  .triggered(
    { on: 'becomes-tapped', filter: { self: true } },
    async (ctx) => {
      ctx.game.gainLife(ctx.controller, 1);
      await ctx.game.scry(ctx.controller, 1);
    },
    { description: 'Whenever this creature becomes tapped, you gain 1 life and scry 1.' }
  )
  .build();
