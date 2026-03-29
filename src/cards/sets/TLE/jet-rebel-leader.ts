import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const JetRebelLeader = CardBuilder.create('Jet, Rebel Leader')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(3, 4)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const library = ctx.game.getLibrary(ctx.controller);
      const top5 = library.slice(0, 5);
      const eligible = top5.filter(
        c => c.definition.types.includes(CardType.CREATURE) && (c.definition.cost?.mana ? (c.definition.cost.mana.generic + c.definition.cost.mana.W + c.definition.cost.mana.U + c.definition.cost.mana.B + c.definition.cost.mana.R + c.definition.cost.mana.G + c.definition.cost.mana.C) : 0) <= 3,
      );
      if (eligible.length > 0) {
        const chosen = await ctx.choices.chooseUpToN(
          'Choose a creature card with mana value 3 or less to put onto the battlefield tapped and attacking',
          eligible,
          1,
          c => c.definition.name,
        );
        for (const card of chosen) {
          ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
          // TODO: Enter tapped and attacking
        }
      }
      // TODO: Put the rest on bottom in random order
    },
    { description: 'Whenever Jet attacks, look at the top five cards of your library. You may put a creature card with mana value 3 or less from among them onto the battlefield tapped and attacking. Put the rest on the bottom in a random order.' },
  )
  .build();
