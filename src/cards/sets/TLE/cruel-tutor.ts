import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CruelTutor = CardBuilder.create('Cruel Tutor')
  .cost('{2}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: {},
      destination: 'LIBRARY_TOP',
      count: 1,
      optional: false,
      shuffle: true,
    });
    ctx.game.loseLife(ctx.controller, 2);
  }, { description: 'Search your library for a card, then shuffle and put that card on top. You lose 2 life.' })
  .build();
