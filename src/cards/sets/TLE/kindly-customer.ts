import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KindlyCustomer = CardBuilder.create('Kindly Customer')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(1, 1)
  .etbEffect((ctx) => {
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'When this creature enters, draw a card.' })
  .build();
