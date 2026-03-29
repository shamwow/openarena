import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createVigilanceAbilities } from '../../../engine/AbilityPrimitives';

export const AangAirNomad = CardBuilder.create('Aang, Air Nomad')
  .cost('{3}{W}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(5, 4)
  .flying()
  .vigilance()
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createVigilanceAbilities(),
      filter: { types: [CardType.CREATURE], controller: 'you', self: false },
    },
    { description: 'Other creatures you control have vigilance.' },
  )
  .build();
