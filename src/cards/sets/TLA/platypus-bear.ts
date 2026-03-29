import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const PlatypusBear = CardBuilder.create('Platypus-Bear')
  .cost('{1}{G/U}')
  .types(CardType.CREATURE)
  .subtypes('Platypus', 'Bear')
  .stats(2, 3)
  .defender()
  .etbEffect((ctx) => {
    ctx.game.mill(ctx.controller, 2);
  }, { description: 'When this creature enters, mill two cards.' })
  // TODO: "Can attack as though it didn't have defender" when Lesson in graveyard
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const graveyard = game.zones[source.controller].GRAVEYARD;
        const hasLesson = graveyard.some(c => c.definition.subtypes.includes('Lesson'));
        if (hasLesson) {
          source.canAttackWithDefender = true;
        }
      },
    },
    { description: 'As long as there is a Lesson card in your graveyard, this creature can attack as though it didn\'t have defender.' },
  )
  .build();
