import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';
import { createFlyingAbilities, createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const DarkDepths = CardBuilder.create('Dark Depths')
  .supertypes('Legendary', 'Snow')
  .types(CardType.LAND)
  .etbEffect((ctx) => {
    ctx.game.addCounters(ctx.source.objectId, 'ice', 10, {
      player: ctx.controller,
      sourceId: ctx.source.objectId,
      sourceCardId: ctx.source.cardId,
      sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
    });
  }, { description: 'Dark Depths enters with ten ice counters on it.' })
  .activated(
    { mana: { generic: 3, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 } },
    (ctx) => {
      ctx.game.removeCounters(ctx.source.objectId, 'ice', 1);
    },
    { description: '{3}: Remove an ice counter from Dark Depths.' }
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source) => {
        if (event.type !== 'COUNTER_REMOVED') return false;
        if ((event as any).objectId !== source.objectId) return false;
        const iceCounters = source.counters['ice'] ?? 0;
        return iceCounters === 0;
      },
    },
    (ctx) => {
      // Sacrifice Dark Depths
      ctx.game.sacrificePermanents(ctx.controller, { name: 'Dark Depths' }, 1, 'Sacrifice Dark Depths');
      // Create Marit Lage token
      ctx.game.createToken(ctx.controller, {
        name: 'Marit Lage',
        types: [CardType.CREATURE],
        subtypes: ['Avatar'],
        supertypes: ['Legendary'],
        power: 20,
        toughness: 20,
        colorIdentity: [ManaColor.BLACK],
        abilities: [...createFlyingAbilities(), ...createIndestructibleAbilities()],
      });
    },
    { description: 'When Dark Depths has no ice counters on it, sacrifice it. If you do, create Marit Lage, a legendary 20/20 black Avatar creature token with flying and indestructible.' }
  )
  .build();
