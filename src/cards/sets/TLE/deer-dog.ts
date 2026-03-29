import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DeerDog = CardBuilder.create('Deer-Dog')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Elk', 'Dog')
  .stats(1, 3)
  .firstStrike()
  .build();
