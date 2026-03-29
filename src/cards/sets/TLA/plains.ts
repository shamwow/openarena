import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Plains = CardBuilder.create('Plains')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Plains')
  .tapForMana('W')
  .build();
