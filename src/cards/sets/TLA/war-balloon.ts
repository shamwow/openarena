import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WarBalloon = CardBuilder.create('War Balloon')
  .cost('{2}{R}')
  .types(CardType.ARTIFACT)
  .subtypes('Vehicle')
  .stats(4, 3)
  .flying()
  .activated(
    { mana: parseManaCost('{1}') },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'fire', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: '{1}: Put a fire counter on this Vehicle.' },
  )
  // TODO: "As long as this Vehicle has three or more fire counters on it, it's an artifact creature."
  // Would need a static ability that conditionally adds Creature type based on counter count
  .crew(3)
  .build();
