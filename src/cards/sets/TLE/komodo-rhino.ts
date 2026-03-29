import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KomodoRhino = CardBuilder.create('Komodo Rhino')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .subtypes('Lizard', 'Rhino')
  .stats(5, 2)
  .trample()
  .build();
