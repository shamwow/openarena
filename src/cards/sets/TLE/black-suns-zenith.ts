import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BlackSunsZenith = CardBuilder.create("Black Sun's Zenith")
  .cost('{X}{B}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of creatures) {
      ctx.game.addCounters(creature.objectId, '-1/-1', x, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
    // Shuffle into library
    ctx.game.moveCard(ctx.source.objectId, 'LIBRARY', ctx.source.owner);
    ctx.game.shuffleLibrary(ctx.source.owner);
  }, { description: "Put X -1/-1 counters on each creature. Shuffle Black Sun's Zenith into its owner's library." })
  .build();
