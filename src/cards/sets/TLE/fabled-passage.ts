import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FabledPassage = CardBuilder.create('Fabled Passage')
  .types(CardType.LAND)
  .activated(
    { tap: true, sacrifice: { self: true } },
    async (ctx) => {
      const selected = await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { types: [CardType.LAND], supertypes: ['Basic'] },
        destination: 'BATTLEFIELD',
        count: 1,
        optional: false,
        shuffle: true,
      });
      for (const card of selected) {
        const instance = ctx.game.getCard(card.objectId);
        if (instance) {
          instance.tapped = true;
        }
      }
      // If you control four or more lands, untap that land
      const landCount = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller).length;
      if (landCount >= 4 && selected.length > 0) {
        ctx.game.untapPermanent(selected[0].objectId);
      }
    },
    { description: '{T}, Sacrifice this land: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. Then if you control four or more lands, untap that land.' }
  )
  .build();
