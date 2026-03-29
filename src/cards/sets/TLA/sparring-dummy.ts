import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SparringDummy = CardBuilder.create('Sparring Dummy')
  .cost('{1}{G}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .subtypes('Scarecrow')
  .stats(1, 3)
  .defender()
  .activated(
    { tap: true },
    async (ctx) => {
      ctx.game.mill(ctx.controller, 1);
      // Check what was milled
      const graveyard = ctx.game.getGraveyard(ctx.controller);
      if (graveyard.length > 0) {
        const topMilled = graveyard[graveyard.length - 1];
        if (topMilled.definition.types.includes(CardType.LAND)) {
          ctx.game.moveCard(topMilled.objectId, 'HAND', ctx.controller);
        }
        if (topMilled.definition.subtypes.includes('Lesson')) {
          ctx.game.gainLife(ctx.controller, 2);
        }
      }
    },
    { description: '{T}: Mill a card. You may put a land card milled this way into your hand. You gain 2 life if a Lesson card is milled this way.' },
  )
  .build();
