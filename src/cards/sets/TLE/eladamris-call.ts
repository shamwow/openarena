import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EladamrisCall = CardBuilder.create("Eladamri's Call")
  .cost('{G}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.CREATURE] },
      destination: 'HAND',
      count: 1,
      optional: false,
      shuffle: true,
    });
  }, { description: 'Search your library for a creature card, reveal that card, put it into your hand, then shuffle.' })
  .build();
