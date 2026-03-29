import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FirebendingStudent = CardBuilder.create('Firebending Student')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Monk')
  .stats(1, 2)
  .prowess()
  // TODO: Firebending X where X is creature's power (dynamic firebending amount)
  .firebending(1)
  .build();
