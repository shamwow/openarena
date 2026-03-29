import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MaiAndZuko = CardBuilder.create('Mai and Zuko')
  .cost('{1}{U}{B}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(3, 5)
  .firebending(3)
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: You may cast Ally spells and artifact spells as though they had flash
      },
    },
    { description: 'You may cast Ally spells and artifact spells as though they had flash.' },
  )
  .build();
