import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Forest = CardBuilder.create('Forest')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Forest')
  .tapForMana('G')
  .build();
