import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FatedFirepower = CardBuilder.create('Fated Firepower')
  .cost('{X}{R}{R}{R}')
  .types(CardType.ENCHANTMENT)
  .flash()
  .etbEffect((ctx) => {
    const x = ctx.xValue ?? 0;
    ctx.game.addCounters(ctx.source.objectId, 'fire', x, {
      player: ctx.controller,
      sourceId: ctx.source.objectId,
      sourceCardId: ctx.source.cardId,
      sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
    });
  }, { description: 'This enchantment enters with X fire counters on it.' })
  // TODO: "If a source you control would deal damage to an opponent or a permanent an opponent controls,
  // it deals that much damage plus an amount of damage equal to the number of fire counters on this enchantment instead."
  // This requires a damage replacement effect which is very complex to implement
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Implement damage amplification replacement effect
      },
    },
    { description: 'If a source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus an amount of damage equal to the number of fire counters on this enchantment instead.' }
  )
  .build();
