import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DragonflySwarm = CardBuilder.create('Dragonfly Swarm')
  .cost('{1}{U}{R}')
  .types(CardType.CREATURE)
  .subtypes('Dragon', 'Insect')
  .stats(0, 3)
  .flying()
  .ward('{1}')
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const graveyard = game.zones[source.controller].GRAVEYARD;
        const count = graveyard.filter(c =>
          !c.definition.types.includes(CardType.CREATURE as any) &&
          !c.definition.types.includes(CardType.LAND as any)
        ).length;
        source.modifiedPower = count;
      },
    },
    { description: "This creature's power is equal to the number of noncreature, nonland cards in your graveyard." }
  )
  .diesEffect((ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const hasLesson = graveyard.some(c => c.definition.subtypes.includes('Lesson'));
    if (hasLesson) {
      ctx.game.drawCards(ctx.controller, 1);
    }
  }, { description: "When this creature dies, if there's a Lesson card in your graveyard, draw a card." })
  .build();
