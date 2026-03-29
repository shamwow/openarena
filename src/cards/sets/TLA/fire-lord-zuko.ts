import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const FireLordZuko = CardBuilder.create('Fire Lord Zuko')
  .cost('{R}{W}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(2, 4)
  // Firebending X where X is Zuko's power
  // TODO: Dynamic firebending based on power; using static 2 as base
  .firebending(2)
  .triggered(
    {
      on: 'custom',
      match: (event, source) => {
        // Whenever you cast a spell from exile or a permanent enters from exile under your control
        if (event.type === GameEventType.SPELL_CAST) {
          return (event as any).controller === source.controller && (event as any).fromZone === 'EXILE';
        }
        if (event.type === GameEventType.ENTERS_BATTLEFIELD) {
          return (event as any).controller === source.controller;
          // TODO: Check if it entered from exile
        }
        return false;
      },
    },
    (ctx) => {
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
    { description: 'Whenever you cast a spell from exile and whenever a permanent you control enters from exile, put a +1/+1 counter on each creature you control.' }
  )
  .build();
