import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Gilacorn = CardBuilder.create('Gilacorn')
  .cost('{B}')
  .types(CardType.CREATURE)
  .subtypes('Lizard')
  .stats(1, 1)
  .deathtouch()
  .build();
