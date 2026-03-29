import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Diresight = CardBuilder.create('Diresight')
  .cost('{2}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    await ctx.game.surveil(ctx.controller, 2);
    ctx.game.drawCards(ctx.controller, 2);
    ctx.game.loseLife(ctx.controller, 2);
  }, { description: 'Surveil 2, then draw two cards. You lose 2 life.' })
  .build();
