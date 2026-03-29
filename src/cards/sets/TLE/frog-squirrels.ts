import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FrogSquirrels = CardBuilder.create('Frog-Squirrels')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Frog', 'Squirrel')
  .stats(2, 2)
  .reach()
  .build();
