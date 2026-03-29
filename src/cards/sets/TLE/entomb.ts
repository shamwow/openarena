import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Entomb = CardBuilder.create('Entomb')
  .cost('{B}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: {},
      destination: 'GRAVEYARD',
      count: 1,
      optional: false,
      shuffle: true,
    });
  }, { description: 'Search your library for a card, put that card into your graveyard, then shuffle.' })
  .build();
