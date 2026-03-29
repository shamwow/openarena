import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WolfCoveVillager = CardBuilder.create('Wolf Cove Villager')
  .cost('{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Peasant')
  .stats(2, 2)
  .entersTapped()
  .build();
