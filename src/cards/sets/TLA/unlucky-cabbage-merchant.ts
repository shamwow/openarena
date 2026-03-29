import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const UnluckyCabbageMerchant = CardBuilder.create('Unlucky Cabbage Merchant')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(2, 2)
  .etbEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Food');
  }, { description: 'When this creature enters, create a Food token.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.SACRIFICED) return false;
        if (!('objectId' in event)) return false;
        const sacEvent = event as typeof event & { objectId: string; controller: string };
        if (sacEvent.controller !== source.controller) return false;
        // Check if sacrificed permanent was a Food
        if (!('lastKnownInformation' in event)) return false;
        const lki = (event as typeof event & { lastKnownInformation?: { subtypes?: string[] } }).lastKnownInformation;
        return lki?.subtypes?.includes('Food') ?? false;
      },
    },
    async (ctx) => {
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: {
          types: [CardType.LAND],
          custom: (card) => card.definition.supertypes?.includes('Basic') ?? false,
        },
        destination: 'BATTLEFIELD',
        count: 1,
        optional: true,
        shuffle: true,
      });
      // Put this creature on the bottom of its owner's library
      ctx.game.moveCard(ctx.source.objectId, 'LIBRARY', ctx.source.owner);
      ctx.game.shuffleLibrary(ctx.source.owner);
    },
    { optional: true, description: 'Whenever you sacrifice a Food, you may search your library for a basic land card and put it onto the battlefield tapped. If you do, put this creature on the bottom of its owner\'s library, then shuffle.' },
  )
  .build();
