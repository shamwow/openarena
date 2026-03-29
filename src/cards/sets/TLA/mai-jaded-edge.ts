import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MaiJadedEdge = CardBuilder.create('Mai, Jaded Edge')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Noble')
  .supertypes('Legendary')
  .stats(1, 3)
  .prowess()
  // TODO: Exhaust — {3}: Put a double strike counter on Mai. (double strike counter not supported)
  .build();
