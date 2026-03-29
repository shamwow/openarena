import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HumbleDefector = CardBuilder.create('Humble Defector')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rogue')
  .stats(2, 1)
  .activated(
    { tap: true },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 2);
      const opponents = ctx.game.getOpponents(ctx.controller);
      if (opponents.length > 0) {
        const target = await ctx.choices.choosePlayer('Choose target opponent to gain control', opponents);
        // TODO: Properly transfer control of this creature to target opponent
      }
    },
    {
      activateOnlyDuringYourTurn: true,
      description: '{T}: Draw two cards. Target opponent gains control of this creature. Activate only during your turn.',
    },
  )
  .build();
