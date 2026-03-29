import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const OstrichHorse = CardBuilder.create('Ostrich-Horse')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .subtypes('Bird', 'Horse')
  .stats(3, 1)
  .etbEffect(async (ctx) => {
    ctx.game.mill(ctx.controller, 3);
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const landCards = graveyard.filter(c => c.definition.types.includes(CardType.LAND));
    if (landCards.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('You may put a land card from among them into your hand', landCards, 1, c => c.definition.name);
      if (chosen.length > 0) {
        ctx.game.moveCard(chosen[0].objectId, 'HAND', ctx.controller);
      } else {
        ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
      }
    } else {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
    }
  }, { description: 'When this creature enters, mill three cards. You may put a land card from among them into your hand. If you don\'t, put a +1/+1 counter on this creature.' })
  .build();
