import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CrackedEarthTechnique = CardBuilder.create('Cracked Earth Technique')
  .cost('{4}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Earthbend 3 (first time)
    const lands1 = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' });
    if (lands1.length > 0) {
      const target1 = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands1, c => c.definition.name);
      ctx.game.earthbendLand(target1.objectId, 3, ctx.controller);
    }
    // Earthbend 3 (second time)
    const lands2 = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' });
    if (lands2.length > 0) {
      const target2 = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands2, c => c.definition.name);
      ctx.game.earthbendLand(target2.objectId, 3, ctx.controller);
    }
    // Gain 3 life
    ctx.game.gainLife(ctx.controller, 3);
  }, { description: 'Earthbend 3, then earthbend 3. You gain 3 life.' })
  .build();
