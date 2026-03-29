import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ForecastingFortuneTeller = CardBuilder.create('Forecasting Fortune Teller')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Advisor', 'Ally')
  .stats(1, 3)
  .etbEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this creature enters, create a Clue token.' })
  .build();
