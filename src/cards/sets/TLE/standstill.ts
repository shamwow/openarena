import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const Standstill = CardBuilder.create('Standstill')
  .cost('{1}{U}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'cast-spell' },
    async (ctx) => {
      if (!ctx.event || ctx.event.type !== GameEventType.SPELL_CAST) return;

      // Sacrifice this enchantment
      ctx.game.sacrificePermanent(ctx.source.objectId, ctx.controller);

      const opponents = ctx.game.getOpponents(ctx.event.castBy);
      for (const opponent of opponents) {
        ctx.game.drawCards(opponent, 3);
      }
    },
    { description: 'When a player casts a spell, sacrifice this enchantment. If you do, each of that player\'s opponents draws three cards.' },
  )
  .build();
