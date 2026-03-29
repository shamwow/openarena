import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WhiteLotusReinforcements = CardBuilder.create('White Lotus Reinforcements')
  .cost('{1}{G}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 3)
  .vigilance()
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 1,
      filter: {
        subtypes: ['Ally'],
        controller: 'you',
        custom: (card, _state) => card.objectId !== undefined,
      },
    },
    { description: 'Other Allies you control get +1/+1.' },
  )
  .build();
