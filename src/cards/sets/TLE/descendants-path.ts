import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const DescendantsPath = CardBuilder.create("Descendants' Path")
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'step', step: 'UPKEEP', whose: 'yours' },
    async (ctx) => {
      const library = ctx.game.getLibrary(ctx.controller);
      if (library.length === 0) return;
      const topCard = library[0];
      // TODO: Reveal the top card
      if (topCard.definition.types.includes(CardType.CREATURE)) {
        const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        const topSubtypes = topCard.definition.subtypes;
        const sharesType = myCreatures.some(c =>
          getEffectiveSubtypes(c).some(st => topSubtypes.includes(st))
        );
        if (sharesType) {
          const cast = await ctx.choices.chooseYesNo(
            `Cast ${topCard.definition.name} without paying its mana cost?`
          );
          if (cast) {
            // TODO: Cast without paying mana cost
            return;
          }
        }
      }
      // Put it on the bottom of the library
      ctx.game.moveCard(topCard.objectId, 'LIBRARY_BOTTOM', ctx.controller);
    },
    { description: "At the beginning of your upkeep, reveal the top card of your library. If it's a creature card that shares a creature type with a creature you control, you may cast it without paying its mana cost. If you don't cast it, put it on the bottom of your library." }
  )
  .build();
