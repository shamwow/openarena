import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FlyingDolphinFish = CardBuilder.create('Flying Dolphin-Fish')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .subtypes('Whale', 'Fish')
  .stats(1, 3)
  .flying()
  .build();
