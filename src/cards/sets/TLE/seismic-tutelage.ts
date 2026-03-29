import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SeismicTutelage = CardBuilder.create('Seismic Tutelage')
  .cost('{3}{G}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'creature', count: 1 })
  .etbEffect(async (ctx) => {
    if (ctx.source.attachedTo) {
      ctx.game.addCounters(ctx.source.attachedTo, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
  }, { description: 'When this Aura enters, put a +1/+1 counter on enchanted creature.' })
  .triggered(
    { on: 'attacks', filter: { custom: (card, _state) => card.attachedTo !== undefined } },
    async (ctx) => {
      if (ctx.source.attachedTo) {
        const target = ctx.game.getCard(ctx.source.attachedTo);
        if (target) {
          const currentCounters = target.counters['+1/+1'] ?? 0;
          ctx.game.addCounters(target.objectId, '+1/+1', currentCounters, {
            player: ctx.controller,
            sourceId: ctx.source.objectId,
            sourceCardId: ctx.source.cardId,
            sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
          });
        }
      }
    },
    { description: 'Whenever enchanted creature attacks, double the number of +1/+1 counters on it.' },
  )
  .build();
