import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TaleOfMomo = CardBuilder.create('Tale of Momo')
  .cost('{2}{W}')
  .types(CardType.SORCERY)
  // TODO: Costs {2} less if a creature left the battlefield under your control this turn
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.CREATURE], subtypes: ['Ally'] },
      destination: 'HAND',
      count: 1,
    });
    // Also check graveyard
    const graveyard = ctx.game.getGraveyard(ctx.controller).filter(c =>
      c.definition.types.includes(CardType.CREATURE) && c.definition.subtypes.includes('Ally')
    );
    if (graveyard.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('You may also return an Ally from your graveyard', graveyard, 0, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
      }
    }
  }, { description: 'Search your library and/or graveyard for an Ally creature card, reveal it, and put it into your hand. If you search your library this way, shuffle.' })
  .build();
