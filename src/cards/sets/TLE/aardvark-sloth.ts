import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AardvarkSloth = CardBuilder.create('Aardvark Sloth')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .subtypes('Sloth', 'Beast')
  .stats(3, 3)
  .lifelink()
  .build();
