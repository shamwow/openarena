import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EnlightenedTutor = CardBuilder.create('Enlightened Tutor')
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: {
        custom: (c) => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.ENCHANTMENT),
      },
      destination: 'LIBRARY_TOP',
      count: 1,
      optional: false,
      shuffle: true,
    });
  }, { description: 'Search your library for an artifact or enchantment card, reveal it, then shuffle and put that card on top.' })
  .build();
