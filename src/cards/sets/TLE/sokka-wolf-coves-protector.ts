import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SokkaWolfCovesProtector = CardBuilder.create("Sokka, Wolf Cove's Protector")
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .vigilance()
  .build();
