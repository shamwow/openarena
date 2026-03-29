import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Consider = CardBuilder.create('Consider')
  .cost('{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    await ctx.game.surveil(ctx.controller, 1);
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Surveil 1. Draw a card.' })
  .build();
