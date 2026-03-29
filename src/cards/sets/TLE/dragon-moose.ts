import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DragonMoose = CardBuilder.create('Dragon Moose')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .subtypes('Dragon', 'Elk')
  .stats(3, 3)
  .haste()
  .build();
