import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ZhaoTheSeethingFlame = CardBuilder.create('Zhao, the Seething Flame')
  .cost('{4}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Soldier')
  .stats(5, 5)
  .menace()
  .build();
