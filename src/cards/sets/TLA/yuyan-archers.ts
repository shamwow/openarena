import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const YuyanArchers = CardBuilder.create('Yuyan Archers')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Archer')
  .stats(3, 1)
  .reach()
  .etbEffect(async (ctx) => {
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length === 0) return;
    const wantDiscard = await ctx.choices.chooseYesNo('Discard a card to draw a card?');
    if (wantDiscard) {
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
      ctx.game.drawCards(ctx.controller, 1);
    }
  }, { optional: true, description: 'When this creature enters, you may discard a card. If you do, draw a card.' })
  .build();
