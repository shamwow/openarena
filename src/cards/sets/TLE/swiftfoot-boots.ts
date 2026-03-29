import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHexproofAbilities, createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const SwiftfootBoots = CardBuilder.create('Swiftfoot Boots')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .grantToAttached({ type: 'grant-abilities', abilities: createHexproofAbilities(), filter: { self: true } })
  .grantToAttached({ type: 'grant-abilities', abilities: createHasteAbilities(), filter: { self: true } })
  .equip('{1}')
  .build();
