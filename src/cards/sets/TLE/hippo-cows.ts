import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HippoCows = CardBuilder.create('Hippo-Cows')
  .cost('{4}{G}')
  .types(CardType.CREATURE)
  .subtypes('Hippo', 'Ox')
  .stats(5, 4)
  .trample()
  .build();
