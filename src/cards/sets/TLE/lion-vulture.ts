import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const LionVulture = CardBuilder.create('Lion Vulture')
  .cost('{3}{B}')
  .types(CardType.CREATURE)
  .subtypes('Cat', 'Bird')
  .stats(2, 2)
  .flying()
  .triggered(
    { on: 'end-step', whose: 'yours' },
    (ctx) => {
      const opponentLostLife = ctx.game.getOpponents(ctx.controller).some(opp => {
        return (ctx.state.eventLog ?? []).some(
          e => e.type === GameEventType.LIFE_LOST && (e as any).player === opp && (e as any).turn === ctx.state.turn,
        );
      });
      if (opponentLostLife) {
        ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
        ctx.game.drawCards(ctx.controller, 1);
      }
    },
    { description: 'At the beginning of your end step, if an opponent lost life this turn, put a +1/+1 counter on this creature and draw a card.' },
  )
  .build();
