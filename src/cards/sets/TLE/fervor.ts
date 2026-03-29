import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const Fervor = CardBuilder.create('Fervor')
  .cost('{2}{R}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createHasteAbilities(),
      filter: { types: [CardType.CREATURE], controller: 'you' },
    },
    { description: 'Creatures you control have haste.' }
  )
  .build();
