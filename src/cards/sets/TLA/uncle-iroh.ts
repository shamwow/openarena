import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const UncleIroh = CardBuilder.create('Uncle Iroh')
  .cost('{1}{R/G}{R/G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(4, 2)
  .firebending(1)
  .staticAbility(
    {
      type: 'cost-reduction',
      amount: 1,
      filter: { custom: (card) => card.definition.subtypes.includes('Lesson') },
      appliesTo: 'you',
    },
    { description: 'Lesson spells you cast cost {1} less to cast.' },
  )
  .build();
