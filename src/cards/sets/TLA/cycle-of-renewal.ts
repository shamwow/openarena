import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CycleOfRenewal = CardBuilder.create('Cycle of Renewal')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Sacrifice a land
    await ctx.game.sacrificePermanents(
      ctx.controller,
      { types: [CardType.LAND], controller: 'you' },
      1,
      'Choose a land to sacrifice',
    );
    // Search for up to two basic land cards, put them onto the battlefield tapped
    const selected = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.LAND], supertypes: ['Basic'] },
      destination: 'BATTLEFIELD',
      count: 2,
      optional: true,
      shuffle: true,
    });
    for (const card of selected) {
      const instance = ctx.game.getCard(card.objectId);
      if (instance) {
        instance.tapped = true;
      }
    }
  }, { description: 'Sacrifice a land. Search your library for up to two basic land cards, put them onto the battlefield tapped, then shuffle.' })
  .build();
