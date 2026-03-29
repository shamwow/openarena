import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard, getEffectiveSubtypes } from '../../../engine/GameState';

export const SouthernAirTemple = CardBuilder.create('Southern Air Temple')
  .cost('{3}{W}')
  .types(CardType.ENCHANTMENT)
  .supertypes('Legendary')
  .subtypes('Shrine')
  .etbEffect(async (ctx) => {
    const shrines = ctx.game.getBattlefield({ subtypes: ['Shrine'], controller: 'you' }, ctx.controller);
    const x = shrines.length;
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    for (const creature of creatures) {
      ctx.game.addCounters(creature.objectId, '+1/+1', x, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
  }, { description: 'When Southern Air Temple enters, put X +1/+1 counters on each creature you control, where X is the number of Shrines you control.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        if (event.objectId === source.objectId) return false;
        const card = findCard(game, event.objectId, event.objectZoneChangeCounter);
        return Boolean(card && getEffectiveSubtypes(card).includes('Shrine'));
      },
    },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      for (const creature of creatures) {
        ctx.game.addCounters(creature.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { description: 'Whenever another Shrine you control enters, put a +1/+1 counter on each creature you control.' },
  )
  .build();
