import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WaterbendingLesson = CardBuilder.create('Waterbending Lesson')
  .cost('{3}{U}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 3);
    // TODO: Check if waterbend {2} was paid; if not, discard a card
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length > 0) {
      const toDiscard = await ctx.choices.chooseOne('Discard a card (unless you waterbend {2})', hand, c => c.definition.name);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
    }
  }, { description: 'Draw three cards. Then discard a card unless you waterbend {2}.' })
  .build();
