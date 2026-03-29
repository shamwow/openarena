import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MysticalTutor = CardBuilder.create('Mystical Tutor')
  .cost('{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const eligible = library.filter(
      c => c.definition.types.includes(CardType.INSTANT) || c.definition.types.includes(CardType.SORCERY),
    );
    if (eligible.length > 0) {
      const chosen = await ctx.choices.chooseOne('Choose an instant or sorcery card', eligible, c => c.definition.name);
      // TODO: Reveal it, shuffle, then put on top of library
      ctx.game.moveCard(chosen.objectId, 'LIBRARY', ctx.controller);
      ctx.game.shuffleLibrary(ctx.controller);
    }
  }, { description: 'Search your library for an instant or sorcery card, reveal it, then shuffle and put that card on top.' })
  .build();
