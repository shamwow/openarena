import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const TheUnagiOfKyoshiIsland = CardBuilder.create('The Unagi of Kyoshi Island')
  .cost('{3}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Serpent')
  .stats(5, 5)
  .flash()
  .ward('{4}')
  .waterbend(4)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.DREW_CARD) return false;
        if (event.player === source.controller) return false;
        // Check if this is the second card drawn this turn by that opponent
        const drawCount = game.eventLog.filter(
          (e) => e.type === GameEventType.DREW_CARD
            && (e as any).player === event.player
            && e.timestamp >= (game.turnStartTimestamp ?? 0),
        ).length;
        return drawCount === 2;
      },
    },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 2);
    },
    { description: 'Whenever an opponent draws their second card each turn, you draw two cards.' },
  )
  .build();
