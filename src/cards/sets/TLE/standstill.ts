import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const Standstill = CardBuilder.create('Standstill')
  .cost('{1}{U}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'cast-spell' },
    async (ctx) => {
      // Sacrifice this enchantment
      ctx.game.sacrificePermanent(ctx.source.objectId, ctx.controller);
      // Each of that player's opponents draws three cards
      // TODO: Identify the casting player from the trigger event
      const opponents = ctx.game.getOpponents(ctx.controller);
      for (const opponent of opponents) {
        ctx.game.drawCards(opponent, 3);
      }
    },
    { description: 'When a player casts a spell, sacrifice this enchantment. If you do, each of that player\'s opponents draws three cards.' },
  )
  .build();
