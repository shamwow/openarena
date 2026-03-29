import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CaptainSisay = CardBuilder.create('Captain Sisay')
  .cost('{2}{G}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Soldier')
  .stats(2, 2)
  .activated(
    { tap: true },
    async (ctx) => {
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { supertypes: ['Legendary'] },
        destination: 'HAND',
        count: 1,
        shuffle: true,
        reveal: true,
      });
    },
    { description: '{T}: Search your library for a legendary card, reveal that card, put it into your hand, then shuffle.' }
  )
  .build();
