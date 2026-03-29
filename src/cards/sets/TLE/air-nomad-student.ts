import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const AirNomadStudent = CardBuilder.create('Air Nomad Student')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Monk')
  .stats(2, 2)
  .flying()
  .triggered(
    { on: 'end-step', whose: 'yours' },
    async (ctx) => {
      // Check if this creature attacked this turn
      const attacked = ctx.state.eventLog?.some(
        e => e.type === GameEventType.ATTACKS &&
        'attackerId' in e && e.attackerId === ctx.source.objectId &&
        e.turn === ctx.state.turn
      ) ?? false;
      if (!attacked) {
        ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { description: 'At the beginning of your end step, if this creature didn\'t attack this turn, put a +1/+1 counter on it.' }
  )
  .build();
