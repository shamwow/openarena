import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const EarthKingdomGeneral = CardBuilder.create('Earth Kingdom General')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
  }, { description: 'When this creature enters, earthbend 2.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source) => {
        if (event.type !== GameEventType.COUNTER_ADDED) return false;
        if ((event as any).counterType !== '+1/+1') return false;
        // Check that the target is a creature controlled by this source's controller
        return (event as any).controller === source.controller;
      },
    },
    (ctx) => {
      // TODO: Track "once per turn" and the amount of counters added
      const countersAdded = 1; // Simplified
      ctx.game.gainLife(ctx.controller, countersAdded);
    },
    { optional: true, oncePerTurn: true, description: 'Whenever you put one or more +1/+1 counters on a creature, you may gain that much life. Do this only once each turn.' }
  )
  .build();
