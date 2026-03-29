import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Clone = CardBuilder.create('Clone')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .subtypes('Shapeshifter')
  .stats(0, 0)
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.objectId !== ctx.source.objectId);
    if (creatures.length > 0) {
      const doCopy = await ctx.choices.chooseYesNo('Enter as a copy of a creature on the battlefield?');
      if (doCopy) {
        const target = await ctx.choices.chooseOne('Choose a creature to copy', creatures, c => c.definition.name);
        // TODO: Full copy effect is complex - simplified to stat/ability copy
        ctx.game.copyPermanent(target.objectId, ctx.controller);
      }
    }
  }, { description: 'You may have this creature enter as a copy of any creature on the battlefield.' })
  .build();
