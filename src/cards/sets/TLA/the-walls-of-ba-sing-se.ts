import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const TheWallsOfBaSingSe = CardBuilder.create('The Walls of Ba Sing Se')
  .cost('{8}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Wall')
  .stats(0, 30)
  .defender()
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createIndestructibleAbilities(),
      filter: {
        controller: 'you',
        custom: (card, _state) => card.objectId !== undefined,
      },
    },
    { description: 'Other permanents you control have indestructible.' },
  )
  .build();
