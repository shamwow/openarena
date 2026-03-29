import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TrainingGrounds = CardBuilder.create('Training Grounds')
  .cost('{U}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    {
      type: 'custom',
      apply: (_game, _source) => {
        // TODO: Reduce activated abilities of creatures you control by {2}.
        // This requires cost modification for activated abilities, which is complex.
      },
    },
    { description: 'Activated abilities of creatures you control cost {2} less to activate. This effect can\'t reduce the mana in that cost to less than one mana.' },
  )
  .build();
