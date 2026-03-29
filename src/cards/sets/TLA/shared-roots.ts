import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SharedRoots = CardBuilder.create('Shared Roots')
  .cost('{1}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { supertypes: ['Basic'], types: [CardType.LAND] },
      destination: 'BATTLEFIELD',
      count: 1,
      tapped: true,
    });
  }, { description: 'Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' })
  .build();
