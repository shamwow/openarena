import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ChakraMeditation = CardBuilder.create('Chakra Meditation')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const instOrSorc = graveyard.filter(c =>
      c.definition.types.includes(CardType.INSTANT) || c.definition.types.includes(CardType.SORCERY)
    );
    if (instOrSorc.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Return up to one target instant or sorcery card from your graveyard to your hand', instOrSorc, 1, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.returnToHand(card.objectId);
      }
    }
  }, { description: 'When this enchantment enters, return up to one target instant or sorcery card from your graveyard to your hand.' })
  .triggered(
    { on: 'cast-spell', filter: { types: [CardType.INSTANT, CardType.SORCERY], controller: 'you' } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
      const graveyard = ctx.game.getGraveyard(ctx.controller);
      const lessonCount = graveyard.filter(c => c.definition.subtypes.includes('Lesson')).length;
      if (lessonCount < 3) {
        const hand = ctx.game.getHand(ctx.controller);
        if (hand.length > 0) {
          const toDiscard = await ctx.choices.chooseOne('Discard a card', hand, c => c.definition.name);
          ctx.game.discardCard(ctx.controller, toDiscard.objectId);
        }
      }
    },
    { description: 'Whenever you cast an instant or sorcery spell, draw a card. Then discard a card unless there are three or more Lesson cards in your graveyard.' }
  )
  .build();
