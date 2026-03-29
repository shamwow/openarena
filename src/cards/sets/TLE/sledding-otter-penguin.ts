import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SleddingOtterPenguin = CardBuilder.create('Sledding Otter-Penguin')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Otter', 'Bird')
  .stats(2, 3)
  .activated(
    { mana: parseManaCost('{3}') },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: '{3}: Put a +1/+1 counter on this creature.' },
  )
  .build();
