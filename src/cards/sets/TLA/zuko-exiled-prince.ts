import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const ZukoExiledPrince = CardBuilder.create('Zuko, Exiled Prince')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(4, 3)
  .firebending(3)
  .activated(
    { mana: parseManaCost('{3}') },
    async (ctx) => {
      const library = ctx.game.getLibrary(ctx.controller);
      if (library.length > 0) {
        const topCard = library[0];
        ctx.game.exilePermanent(topCard.objectId);
        // TODO: Grant permission to play the exiled card this turn
      }
    },
    { description: '{3}: Exile the top card of your library. You may play that card this turn.' },
  )
  .build();
