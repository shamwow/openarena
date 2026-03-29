import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationsConquest = CardBuilder.create("Fire Nation's Conquest")
  .cost('{2}{R}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 0,
      filter: { types: [CardType.CREATURE], controller: 'you' },
    },
    { description: 'Creatures you control get +1/+0.' },
  )
  .build();
