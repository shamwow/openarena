import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SaberToothMooseLion = CardBuilder.create('Saber-Tooth Moose-Lion')
  .cost('{4}{G}{G}')
  .types(CardType.CREATURE)
  .subtypes('Elk', 'Cat')
  .stats(7, 7)
  .reach()
  .landcycling('{2}', 'Forest')
  .build();
