import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const RebelliousCaptives = CardBuilder.create('Rebellious Captives')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(2, 2)
  .activated(
    { mana: parseManaCost('{6}') },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 2, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
      // Earthbend 2
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
      }
    },
    {
      isExhaust: true,
      description: 'Exhaust — {6}: Put two +1/+1 counters on this creature, then earthbend 2.',
    },
  )
  .build();
