import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TundraWall = CardBuilder.create('Tundra Wall')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Wall')
  .stats(0, 4)
  .defender()
  .build();
