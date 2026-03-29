import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Brainstorm = CardBuilder.create('Brainstorm')
  .cost('{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 3);
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length >= 2) {
      const toReturn = await ctx.choices.chooseN('Put two cards from your hand on top of your library', hand, 2, c => c.definition.name);
      for (const card of toReturn) {
        ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
      }
    }
  }, { description: 'Draw three cards, then put two cards from your hand on top of your library in any order.' })
  .build();
