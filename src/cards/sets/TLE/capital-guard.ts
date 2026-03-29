import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CapitalGuard = CardBuilder.create('Capital Guard')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(2, 2)
  .build();
