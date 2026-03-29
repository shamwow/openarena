import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ElephantRat = CardBuilder.create('Elephant-Rat')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Elephant', 'Rat')
  .stats(1, 3)
  .menace()
  .build();
