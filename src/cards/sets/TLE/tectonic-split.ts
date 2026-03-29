import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TectonicSplit = CardBuilder.create('Tectonic Split')
  .cost('{4}{G}{G}')
  .types(CardType.ENCHANTMENT)
  // TODO: As an additional cost, sacrifice half the lands you control, rounded up
  .hexproof()
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        // Lands you control have "{T}: Add three mana of any one color."
        // TODO: Grant mana ability to all lands you control
      },
    },
    { description: 'Lands you control have "{T}: Add three mana of any one color."' },
  )
  .build();
