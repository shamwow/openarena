import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WarshipScout = CardBuilder.create('Warship Scout')
  .cost('{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Scout')
  .stats(2, 1)
  .build();
