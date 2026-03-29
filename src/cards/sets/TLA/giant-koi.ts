import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const GiantKoi = CardBuilder.create('Giant Koi')
  .cost('{4}{U}{U}')
  .types(CardType.CREATURE)
  .subtypes('Fish')
  .stats(5, 7)
  // TODO: "Waterbend {3}: This creature can't be blocked this turn" — can't-be-blocked restriction not fully supported
  .waterbend(3)
  .landcycling('{2}', 'Island')
  .build();
