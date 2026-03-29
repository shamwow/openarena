import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EmptyCityRuse = CardBuilder.create('Empty City Ruse')
  .cost('{W}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length > 0) {
      const target = await ctx.choices.choosePlayer('Target opponent skips combat phases next turn', opponents);
      // TODO: "Target opponent skips all combat phases of their next turn" requires turn modification
      void target;
    }
  }, { description: 'Target opponent skips all combat phases of their next turn.' })
  .build();
