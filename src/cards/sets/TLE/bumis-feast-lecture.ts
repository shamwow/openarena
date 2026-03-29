import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BumisFeastLecture = CardBuilder.create("Bumi's Feast Lecture")
  .cost('{1}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Food');
    // Count Foods after creating
    const foods = ctx.game.getBattlefield({ subtypes: ['Food'], controller: 'you' }, ctx.controller);
    const x = foods.length * 2;
    if (x > 0) {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, x, ctx.controller);
      }
    }
  }, { description: 'Create a Food token. Then earthbend X, where X is twice the number of Foods you control.' })
  .build();
