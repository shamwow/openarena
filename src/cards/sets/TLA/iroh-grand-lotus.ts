import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const IrohGrandLotus = CardBuilder.create('Iroh, Grand Lotus')
  .cost('{3}{G}{U}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(5, 5)
  .firebending(2)
  // TODO: During your turn, each non-Lesson instant and sorcery card in your graveyard has flashback equal to its mana cost
  // TODO: During your turn, each Lesson card in your graveyard has flashback {1}
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Grant flashback to graveyard cards during your turn
      },
    },
    { description: 'During your turn, each non-Lesson instant and sorcery card in your graveyard has flashback. The flashback cost is equal to that card\'s mana cost. During your turn, each Lesson card in your graveyard has flashback {1}.' },
  )
  .build();
