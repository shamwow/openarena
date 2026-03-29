import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const GliderKids = CardBuilder.create('Glider Kids')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Pilot', 'Ally')
  .stats(2, 3)
  .flying()
  .etbEffect(async (ctx) => {
    await ctx.game.scry(ctx.controller, 1);
  }, { description: 'When this creature enters, scry 1.' })
  .build();
