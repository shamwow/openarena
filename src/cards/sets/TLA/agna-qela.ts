import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AgnaQela = CardBuilder.create("Agna Qel'a")
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({ supertypes: ['Basic'] })
  .tapForMana('U')
  .activated(
    { mana: parseManaCost('{2}{U}'), tap: true },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length > 0) {
        const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
        ctx.game.discardCard(ctx.controller, toDiscard.objectId);
      }
    },
    { description: '{2}{U}, {T}: Draw a card, then discard a card.' }
  )
  .build();
