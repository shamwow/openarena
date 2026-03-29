import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EarthbendingLesson = CardBuilder.create('Earthbending Lesson')
  .cost('{3}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 4', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 4, ctx.controller);
    }
  }, { description: 'Earthbend 4.' })
  .build();
