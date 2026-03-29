import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ManyPartings = CardBuilder.create('Many Partings')
  .cost('{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.LAND], supertypes: ['Basic'] },
      destination: 'HAND',
      count: 1,
      reveal: true,
    });
    ctx.game.createPredefinedToken(ctx.controller, 'Food');
  }, { description: 'Search your library for a basic land card, reveal it, put it into your hand, then shuffle. Create a Food token.' })
  .build();
