import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const EarthKingsLieutenant = CardBuilder.create("Earth King's Lieutenant")
  .cost('{G}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(1, 1)
  .trample()
  .etbEffect((ctx) => {
    const allies = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
      .filter(c => c.objectId !== ctx.source.objectId && getEffectiveSubtypes(c).includes('Ally'));
    for (const ally of allies) {
      ctx.game.addCounters(ally.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
  }, { description: 'When this creature enters, put a +1/+1 counter on each other Ally creature you control.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if ((event as any).controller !== source.controller) return false;
        if ((event as any).objectId === source.objectId) return false;
        const { findCard } = require('../../../engine/GameState');
        const entering = findCard(game, (event as any).objectId, (event as any).objectZoneChangeCounter);
        return Boolean(entering && getEffectiveSubtypes(entering).includes('Ally'));
      },
    },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever another Ally you control enters, put a +1/+1 counter on this creature.' }
  )
  .build();
