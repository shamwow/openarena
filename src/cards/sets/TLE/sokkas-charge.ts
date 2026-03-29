import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createDoubleStrikeAbilities, createLifelinkAbilities } from '../../../engine/AbilityPrimitives';

export const SokkasCharge = CardBuilder.create("Sokka's Charge")
  .cost('{3}{W}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: [...createDoubleStrikeAbilities(), ...createLifelinkAbilities()],
      filter: {
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        controller: 'you',
      },
    },
    {
      condition: (game, source) => game.activePlayer === source.controller,
      description: 'During your turn, Allies you control have double strike and lifelink.',
    },
  )
  .build();
