import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Island = CardBuilder.create('Island')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Island')
  .tapForMana('U')
  .build();
