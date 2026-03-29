import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationAmbushers = CardBuilder.create('Fire Nation Ambushers')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(3, 2)
  .flash()
  .build();
