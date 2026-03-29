import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DarkDeal = CardBuilder.create('Dark Deal')
  .cost('{2}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const allPlayers = [ctx.controller, ...ctx.game.getOpponents(ctx.controller)];
    for (const player of allPlayers) {
      const hand = ctx.game.getHand(player);
      const handSize = hand.length;
      for (const card of [...hand]) {
        ctx.game.discardCard(player, card.objectId);
      }
      if (handSize > 1) {
        ctx.game.drawCards(player, handSize - 1);
      }
    }
  }, { description: 'Each player discards all the cards in their hand, then draws that many cards minus one.' })
  .build();
