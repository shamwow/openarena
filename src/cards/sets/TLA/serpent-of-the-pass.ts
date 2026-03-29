import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const SerpentOfThePass = CardBuilder.create('Serpent of the Pass')
  .cost('{5}{U}{U}')
  .types(CardType.CREATURE)
  .subtypes('Serpent')
  .stats(6, 5)
  // TODO: Flash if 3+ Lesson cards in graveyard
  // TODO: Costs {1} less for each noncreature, nonland card in graveyard
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Conditional flash and cost reduction
      },
    },
    { description: 'If there are three or more Lesson cards in your graveyard, you may cast this spell as though it had flash. This spell costs {1} less to cast for each noncreature, nonland card in your graveyard.' },
  )
  .build();
