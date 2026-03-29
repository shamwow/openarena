import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const IguanaParrot = CardBuilder.create('Iguana Parrot')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Lizard', 'Bird', 'Pirate')
  .stats(2, 2)
  .flying()
  .vigilance()
  .prowess()
  .build();
