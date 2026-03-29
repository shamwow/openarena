import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const KnowledgeSeeker = CardBuilder.create('Knowledge Seeker')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .subtypes('Fox', 'Spirit')
  .stats(2, 1)
  .vigilance()
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.DREW_CARD) return false;
        if (event.player !== source.controller) return false;
        // Check if this is the second card drawn this turn
        const drawCount = game.eventLog?.filter(
          e => e.type === GameEventType.DREW_CARD && e.player === source.controller && e.turn === game.turn,
        ).length ?? 0;
        return drawCount === 2;
      },
    },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever you draw your second card each turn, put a +1/+1 counter on this creature.' },
  )
  .diesEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this creature dies, create a Clue token.' })
  .build();
