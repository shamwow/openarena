import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AangsJourney = CardBuilder.create("Aang's Journey")
  .cost('{2}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .kicker('{2}')
  .spellEffect(async (ctx) => {
    const kicked = ctx.additionalCostsPaid?.includes('kicker');
    if (kicked) {
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { subtypes: ['Basic'] },
        destination: 'HAND',
        count: 1,
        shuffle: false,
      });
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { subtypes: ['Shrine'] },
        destination: 'HAND',
        count: 1,
        shuffle: true,
      });
    } else {
      await ctx.game.searchLibraryWithOptions({
        player: ctx.controller,
        filter: { subtypes: ['Basic'] },
        destination: 'HAND',
        count: 1,
        shuffle: true,
      });
    }
    ctx.game.gainLife(ctx.controller, 2);
  }, { description: 'Search your library for a basic land card. If kicked, also search for a Shrine card. You gain 2 life.' })
  .build();
