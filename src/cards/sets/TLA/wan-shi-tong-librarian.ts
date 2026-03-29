import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const WanShiTongLibrarian = CardBuilder.create('Wan Shi Tong, Librarian')
  .cost('{X}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bird', 'Spirit')
  .stats(1, 1)
  .flash()
  .flying()
  .vigilance()
  .etbEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    if (x > 0) {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', x);
    }
    const drawCount = Math.floor(x / 2);
    if (drawCount > 0) {
      ctx.game.drawCards(ctx.controller, drawCount);
    }
  }, { description: 'When Wan Shi Tong enters, put X +1/+1 counters on him. Then draw half X cards, rounded down.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, _game) => {
        if (event.type !== GameEventType.SEARCHED_LIBRARY) return false;
        const searchEvent = event as typeof event & { player?: string };
        return searchEvent.player !== source.controller;
      },
    },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever an opponent searches their library, put a +1/+1 counter on Wan Shi Tong and draw a card.' },
  )
  .build();
