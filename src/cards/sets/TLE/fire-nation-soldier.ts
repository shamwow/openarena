import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationSoldier = CardBuilder.create('Fire Nation Soldier')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(3, 2)
  .haste()
  .build();
