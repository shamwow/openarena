import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MasterPiandao = CardBuilder.create('Master Piandao')
  .cost('{4}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(4, 4)
  .firstStrike()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const library = ctx.game.getLibrary(ctx.controller);
      const top4 = library.slice(0, 4);
      const eligible = top4.filter(
        c => c.definition.subtypes.includes('Ally') ||
             c.definition.subtypes.includes('Equipment') ||
             c.definition.subtypes.includes('Lesson'),
      );
      if (eligible.length > 0) {
        const chosen = await ctx.choices.chooseUpToN(
          'Choose an Ally, Equipment, or Lesson card to put into your hand',
          eligible,
          1,
          c => c.definition.name,
        );
        for (const card of chosen) {
          ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
        }
      }
      // TODO: Put the rest on bottom in random order
    },
    { description: 'Whenever Master Piandao attacks, look at the top four cards of your library. You may reveal an Ally, Equipment, or Lesson card from among them and put it into your hand. Put the rest on the bottom in a random order.' },
  )
  .build();
