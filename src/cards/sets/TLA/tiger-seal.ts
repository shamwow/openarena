import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const TigerSeal = CardBuilder.create('Tiger-Seal')
  .cost('{U}')
  .types(CardType.CREATURE)
  .subtypes('Cat', 'Seal')
  .stats(3, 3)
  .vigilance()
  .triggered(
    { on: 'upkeep', whose: 'yours' },
    (ctx) => {
      ctx.game.tapPermanent(ctx.source.objectId);
    },
    { description: 'At the beginning of your upkeep, tap this creature.' },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.DREW_CARD) return false;
        if (!('player' in event)) return false;
        const drawEvent = event as typeof event & { player: string };
        if (drawEvent.player !== source.controller) return false;
        const drawsThisTurn = game.eventLog.filter(
          e => e.type === GameEventType.DREW_CARD &&
            'player' in e && (e as typeof e & { player: string }).player === source.controller &&
            e.timestamp >= (game.turnStartTimestamp ?? 0),
        );
        return drawsThisTurn.length === 2;
      },
    },
    (ctx) => {
      ctx.game.untapPermanent(ctx.source.objectId);
    },
    { description: 'Whenever you draw your second card each turn, untap this creature.' },
  )
  .build();
