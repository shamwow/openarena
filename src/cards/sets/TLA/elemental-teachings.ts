import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ElementalTeachings = CardBuilder.create('Elemental Teachings')
  .cost('{4}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Search for up to 4 land cards with different names
    // TODO: Enforce "different names" constraint
    const selected = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.LAND] },
      destination: 'HAND',
      count: 4,
      optional: true,
      shuffle: true,
    });
    if (selected.length >= 2) {
      // Opponent chooses 2 to put into graveyard
      const opponents = ctx.game.getOpponents(ctx.controller);
      if (opponents.length > 0) {
        // TODO: Opponent should make this choice
        const toGraveyard = await ctx.choices.chooseUpToN(
          'Opponent chooses two cards to put into your graveyard',
          selected,
          2,
          c => c.definition.name
        );
        for (const card of toGraveyard) {
          ctx.game.moveCard(card.objectId, 'GRAVEYARD', ctx.controller);
        }
        const graveyardIds = new Set(toGraveyard.map(c => c.objectId));
        for (const card of selected) {
          if (!graveyardIds.has(card.objectId)) {
            ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
            const instance = ctx.game.getCard(card.objectId);
            if (instance) instance.tapped = true;
          }
        }
      }
    } else {
      // Less than 2, put all onto battlefield tapped
      for (const card of selected) {
        ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
        const instance = ctx.game.getCard(card.objectId);
        if (instance) instance.tapped = true;
      }
    }
  }, { description: "Search your library for up to four land cards with different names and reveal them. An opponent chooses two of those cards. Put the chosen cards into your graveyard and the rest onto the battlefield tapped, then shuffle." })
  .build();
