import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const GreatDivideGuide = CardBuilder.create('Great Divide Guide')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Scout', 'Ally')
  .stats(2, 3)
  // TODO: Each land and Ally you control has "{T}: Add one mana of any color."
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Grant "{T}: Add one mana of any color" to each land and Ally you control
      },
    },
    { description: 'Each land and Ally you control has "{T}: Add one mana of any color."' },
  )
  .build();
