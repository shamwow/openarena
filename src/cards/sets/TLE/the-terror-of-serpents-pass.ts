import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TheTerrorOfSerpentsPass = CardBuilder.create("The Terror of Serpent's Pass")
  .cost('{5}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Serpent')
  .stats(8, 8)
  .hexproof()
  .build();
