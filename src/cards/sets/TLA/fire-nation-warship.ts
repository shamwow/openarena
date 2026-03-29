import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationWarship = CardBuilder.create('Fire Nation Warship')
  .cost('{3}')
  .types(CardType.ARTIFACT)
  .subtypes('Vehicle')
  .stats(4, 4)
  .reach()
  .diesEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this Vehicle dies, create a Clue token.' })
  .crew(2)
  .build();
