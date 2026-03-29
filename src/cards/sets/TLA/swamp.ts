import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Swamp = CardBuilder.create('Swamp')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Swamp')
  .tapForMana('B')
  .build();
