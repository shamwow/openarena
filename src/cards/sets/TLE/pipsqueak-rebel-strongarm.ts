import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const PipsqueakRebelStrongarm = CardBuilder.create('Pipsqueak, Rebel Strongarm')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(4, 4)
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Pipsqueak can't attack alone unless he has a +1/+1 counter on him
      },
    },
    { description: "Pipsqueak can't attack alone unless he has a +1/+1 counter on him." },
  )
  .build();
