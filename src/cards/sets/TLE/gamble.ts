import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Gamble = CardBuilder.create('Gamble')
  .cost('{R}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    if (library.length === 0) return;
    const chosen = await ctx.choices.chooseOne('Search your library for a card', library, c => c.definition.name);
    ctx.game.moveCard(chosen.objectId, 'HAND', ctx.controller);
    // Discard a card at random
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length > 0) {
      const randomIndex = Math.floor(Math.random() * hand.length);
      ctx.game.moveCard(hand[randomIndex].objectId, 'GRAVEYARD', ctx.controller);
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'Search your library for a card, put that card into your hand, discard a card at random, then shuffle.' })
  .build();
