import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TurtleSeals = CardBuilder.create('Turtle-Seals')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .subtypes('Turtle', 'Seal')
  .stats(2, 4)
  .vigilance()
  .build();
