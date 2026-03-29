import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Bribery = CardBuilder.create('Bribery')
  .cost('{3}{U}{U}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length === 0) return;
    const opponent = await ctx.choices.choosePlayer('Choose target opponent', opponents);
    await ctx.game.searchLibraryWithOptions({
      player: opponent,
      chooser: ctx.controller,
      filter: { types: [CardType.CREATURE] },
      destination: 'BATTLEFIELD',
      count: 1,
      shuffle: true,
    });
  }, { description: "Search target opponent's library for a creature card and put that card onto the battlefield under your control. Then that player shuffles." })
  .build();
