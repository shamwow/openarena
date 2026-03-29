import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Prosperity = CardBuilder.create('Prosperity')
  .cost('{X}{U}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    for (const player of ctx.game.getActivePlayers()) {
      ctx.game.drawCards(player, x);
    }
  }, { description: 'Each player draws X cards.' })
  .build();
