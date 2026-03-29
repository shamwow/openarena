import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TheLionTurtle = CardBuilder.create('The Lion-Turtle')
  .cost('{1}{G}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Elder', 'Cat', 'Turtle')
  .stats(3, 6)
  .vigilance()
  .reach()
  .etbEffect((ctx) => {
    ctx.game.gainLife(ctx.controller, 3);
  }, { description: 'When The Lion-Turtle enters, you gain 3 life.' })
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const graveyard = game.zones[source.controller].GRAVEYARD;
        const lessonCount = graveyard.filter(c => c.definition.subtypes?.includes('Lesson')).length;
        if (lessonCount < 3) {
          // TODO: Properly restrict attack/block unless 3+ Lessons in graveyard
        }
      },
    },
    { description: 'The Lion-Turtle can\'t attack or block unless there are three or more Lesson cards in your graveyard.' },
  )
  .tapForAnyColor()
  .build();
