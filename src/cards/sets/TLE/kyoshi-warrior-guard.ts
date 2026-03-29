import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KyoshiWarriorGuard = CardBuilder.create('Kyoshi Warrior Guard')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 3)
  .build();
