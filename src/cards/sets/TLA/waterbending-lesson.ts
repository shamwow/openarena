import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WaterbendingLesson = CardBuilder.create('Waterbending Lesson')
  .cost('{3}{U}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .additionalCost('waterbend-cost', { waterbend: 2 }, 'Waterbend {2}', { optional: true })
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 3);
    if (ctx.additionalCostsPaid?.includes('waterbend-cost')) {
      return;
    }
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length > 0) {
      const toDiscard = await ctx.choices.chooseOne('Discard a card (unless you waterbend {2})', hand, c => c.definition.name);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
    }
  }, { description: 'Draw three cards. Then discard a card unless you waterbend {2}.' })
  .build();
