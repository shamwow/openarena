import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FeveredVisions = CardBuilder.create('Fevered Visions')
  .cost('{1}{U}{R}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'step', step: 'END' },
    (ctx) => {
      const activePlayer = ctx.state.activePlayer;
      ctx.game.drawCards(activePlayer, 1);
      if (activePlayer !== ctx.controller) {
        const hand = ctx.game.getHand(activePlayer);
        if (hand.length >= 4) {
          ctx.game.dealDamage(ctx.source.objectId, activePlayer, 2, false);
        }
      }
    },
    { description: 'At the beginning of each player\'s end step, that player draws a card. If the player is your opponent and has four or more cards in hand, this enchantment deals 2 damage to that player.' }
  )
  .build();
