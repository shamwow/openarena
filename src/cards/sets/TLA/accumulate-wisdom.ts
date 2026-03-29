import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AccumulateWisdom = CardBuilder.create('Accumulate Wisdom')
  .cost('{1}{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const lessonCount = graveyard.filter(c => c.definition.subtypes.includes('Lesson')).length;
    const library = ctx.game.getLibrary(ctx.controller);
    const topCards = library.slice(0, 3);
    if (topCards.length === 0) return;

    if (lessonCount >= 3) {
      for (const card of topCards) {
        ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
      }
    } else {
      const chosen = await ctx.choices.chooseOne('Choose a card to put into your hand', topCards, c => c.definition.name);
      ctx.game.moveCard(chosen.objectId, 'HAND', ctx.controller);
      const rest = topCards.filter(c => c.objectId !== chosen.objectId);
      for (const card of rest) {
        ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
      }
    }
  }, { description: 'Look at the top 3 cards. Put one into your hand and rest on bottom. If 3+ Lessons in graveyard, put all into your hand.' })
  .build();
