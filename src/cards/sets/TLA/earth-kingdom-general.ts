import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const EarthKingdomGeneral = CardBuilder.create('Earth Kingdom General')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller);
    if (lands.length === 0) return;

    const target = await ctx.choices.chooseOne(
      'Choose a land you control',
      lands,
      (card) => card.definition.name,
    );

    ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
  }, { description: 'When this creature enters, earthbend 2.' })
  .triggered(
    { on: 'counter-placed', counterType: '+1/+1', whose: 'yours', filter: { types: [CardType.CREATURE] } },
    async (ctx) => {
      if (ctx.event?.type !== GameEventType.COUNTER_ADDED) return;
      const gain = await ctx.choices.chooseYesNo(`Earth Kingdom General: Gain ${ctx.event.amount} life?`);
      if (gain) {
        ctx.game.gainLife(ctx.controller, ctx.event.amount);
      }
    },
    { optional: true, oncePerTurn: true, description: 'Whenever you put one or more +1/+1 counters on a creature, you may gain that much life. Do this only once each turn.' }
  )
  .build();
