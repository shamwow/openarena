import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KataraTheFearless = CardBuilder.create('Katara, the Fearless')
  .cost('{G}{W}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: If a triggered ability of an Ally you control triggers, that ability triggers an additional time
      },
    },
    { description: 'If a triggered ability of an Ally you control triggers, that ability triggers an additional time.' },
  )
  .build();
