import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FranticSearch = CardBuilder.create('Frantic Search')
  .cost('{2}{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 2);
    const hand = ctx.game.getHand(ctx.controller);
    for (let i = 0; i < 2 && hand.length > 0; i++) {
      const toDiscard = await ctx.choices.chooseOne(`Discard a card (${i + 1}/2)`, ctx.game.getHand(ctx.controller), c => c.definition.name);
      ctx.game.moveCard(toDiscard.objectId, 'GRAVEYARD', ctx.controller);
    }
    // Untap up to three lands
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller)
      .filter(c => c.tapped);
    if (lands.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Untap up to three lands', lands, 3, c => c.definition.name);
      for (const land of chosen) {
        ctx.game.untapPermanent(land.objectId);
      }
    }
  }, { description: 'Draw two cards, then discard two cards. Untap up to three lands.' })
  .build();
