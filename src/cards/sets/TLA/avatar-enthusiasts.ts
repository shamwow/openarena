import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AvatarEnthusiasts = CardBuilder.create('Avatar Enthusiasts')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(2, 2)
  .triggered(
    { on: 'enter-battlefield', filter: { subtypes: ['Ally'], controller: 'you' } },
    async (ctx) => {
      if (ctx.event && 'objectId' in ctx.event && ctx.event.objectId === ctx.source.objectId) return;
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever another Ally you control enters, put a +1/+1 counter on this creature.' }
  )
  .build();
