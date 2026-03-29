import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Rockalanche = CardBuilder.create('Rockalanche')
  .cost('{2}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const forests = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller)
      .filter(c => c.definition.subtypes.includes('Forest'));
    const x = forests.length;
    if (x > 0) {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, x, ctx.controller);
      }
    }
  }, { description: 'Earthbend X, where X is the number of Forests you control.' })
  .flashback('{5}{G}')
  .build();
