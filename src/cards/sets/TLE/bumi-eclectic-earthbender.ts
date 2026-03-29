import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BumiEclecticEarthbender = CardBuilder.create('Bumi, Eclectic Earthbender')
  .cost('{3}{G}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 1', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 1, ctx.controller);
    }
  }, { description: 'When Bumi enters, earthbend 1.' })
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const landCreatures = ctx.game.getBattlefield({ types: [CardType.LAND, CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.definition.types.includes(CardType.LAND) && c.definition.types.includes(CardType.CREATURE) ||
          (c.counters['+1/+1'] ?? 0) > 0 && c.definition.types.includes(CardType.LAND));
      for (const land of landCreatures) {
        ctx.game.addCounters(land.objectId, '+1/+1', 2, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { description: 'Whenever Bumi attacks, put two +1/+1 counters on each land creature you control.' }
  )
  .build();
