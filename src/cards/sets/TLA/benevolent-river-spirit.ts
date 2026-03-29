import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BenevolentRiverSpirit = CardBuilder.create('Benevolent River Spirit')
  .cost('{U}{U}')
  .types(CardType.CREATURE)
  .subtypes('Spirit')
  .stats(4, 5)
  .waterbend(5)
  .flying()
  .ward('{2}')
  .etbEffect(async (ctx) => {
    await ctx.game.scry(ctx.controller, 2);
  }, { description: 'When this creature enters, scry 2.' })
  .build();
