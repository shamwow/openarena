import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SpiritWaterRevival = CardBuilder.create('Spirit Water Revival')
  .cost('{1}{U}{U}')
  .types(CardType.SORCERY)
  .additionalCost('waterbend-cost', { waterbend: 6 }, 'Waterbend {6}', { optional: true })
  .spellEffect(async (ctx) => {
    if (ctx.additionalCostsPaid?.includes('waterbend-cost')) {
      // Shuffle graveyard into library, draw 7, no max hand size
      const graveyard = ctx.game.getGraveyard(ctx.controller);
      for (const card of graveyard) {
        ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
      }
      ctx.game.shuffleLibrary(ctx.controller);
      ctx.game.drawCards(ctx.controller, 7);
      // TODO: No maximum hand size for the rest of the game
    } else {
      ctx.game.drawCards(ctx.controller, 2);
    }
    // Exile Spirit Water Revival
    ctx.game.moveCard(ctx.source.objectId, 'EXILE');
  }, { description: 'Draw two cards. If this spell\'s additional cost was paid, instead shuffle your graveyard into your library, draw seven cards, and you have no maximum hand size for the rest of the game. Exile Spirit Water Revival.' })
  .build();
