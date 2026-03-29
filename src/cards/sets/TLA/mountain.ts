import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Mountain = CardBuilder.create('Mountain')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Mountain')
  .tapForMana('R')
  .build();
