import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const VisionsOfBeyond = CardBuilder.create('Visions of Beyond')
  .cost('{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // Check if any graveyard has 20+ cards
    const allPlayers = ctx.game.getActivePlayers();
    const anyLargeGraveyard = allPlayers.some(p => ctx.game.getGraveyard(p).length >= 20);
    if (anyLargeGraveyard) {
      ctx.game.drawCards(ctx.controller, 3);
    } else {
      ctx.game.drawCards(ctx.controller, 1);
    }
  }, { description: 'Draw a card. If a graveyard has twenty or more cards in it, draw three cards instead.' })
  .build();
