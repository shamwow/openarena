import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WaterTribeRallier = CardBuilder.create('Water Tribe Rallier')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 2)
  .activated(
    { mana: parseManaCost('{5}') },
    async (ctx) => {
      // Look at top 4 cards, may reveal creature with power 3 or less
      const library = ctx.game.getLibrary(ctx.controller);
      const topCards = library.slice(0, 4);
      const validCreatures = topCards.filter(c =>
        c.definition.types.includes(CardType.CREATURE) &&
        (c.definition.power ?? 0) <= 3,
      );
      if (validCreatures.length > 0) {
        const chosen = await ctx.choices.chooseUpToN('Reveal a creature with power 3 or less to put into your hand', validCreatures, 1, c => c.definition.name);
        for (const card of chosen) {
          ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
        }
      }
      // Put the rest on bottom in random order
      ctx.game.shuffleLibrary(ctx.controller);
    },
    {
      description: 'Waterbend {5}: Look at the top four cards of your library. You may reveal a creature card with power 3 or less and put it into your hand. Put the rest on the bottom in a random order.',
    },
  )
  .waterbend(5)
  .build();
