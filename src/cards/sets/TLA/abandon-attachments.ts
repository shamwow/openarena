import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AbandonAttachments = CardBuilder.create('Abandon Attachments')
  .cost('{1}{U/R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length === 0) return;
    const wantDiscard = await ctx.choices.chooseYesNo('Discard a card to draw two cards?');
    if (wantDiscard) {
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
      ctx.game.drawCards(ctx.controller, 2);
    }
  }, { description: 'You may discard a card. If you do, draw two cards.' })
  .build();
