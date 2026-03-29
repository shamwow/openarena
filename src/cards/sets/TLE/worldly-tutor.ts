import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WorldlyTutor = CardBuilder.create('Worldly Tutor')
  .cost('{G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const results = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.CREATURE] },
      destination: 'LIBRARY',
      count: 1,
      optional: false,
      shuffle: true,
      reveal: true,
    });
    // The card goes on top of the library after shuffle
    // TODO: Ensure the card is placed on top after shuffling
    void results;
  }, { description: 'Search your library for a creature card, reveal it, then shuffle and put the card on top.' })
  .build();
