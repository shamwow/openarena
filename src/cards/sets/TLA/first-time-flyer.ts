import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FirstTimeFlyer = CardBuilder.create('First-Time Flyer')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Pilot', 'Ally')
  .stats(1, 2)
  .flying()
  .staticAbility(
    {
      type: 'pump',
      power: 1,
      toughness: 1,
      filter: { self: true },
    },
    {
      condition: (game, source) => {
        const graveyard = game.zones[source.controller]?.GRAVEYARD ?? [];
        return graveyard.some(c => c.definition.subtypes.includes('Lesson'));
      },
      description: 'This creature gets +1/+1 as long as there\'s a Lesson card in your graveyard.',
    },
  )
  .build();
