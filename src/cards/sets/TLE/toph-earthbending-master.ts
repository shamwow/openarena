import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TophEarthbendingMaster = CardBuilder.create('Toph, Earthbending Master')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 4)
  .landfall(async (ctx) => {
    ctx.game.addPlayerCounters(ctx.controller, 'experience', 1);
  }, { description: 'Landfall — Whenever a land you control enters, you get an experience counter.' })
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const expCounters = ctx.state.players[ctx.controller].counters?.experience ?? 0;
      if (expCounters > 0) {
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        if (lands.length > 0) {
          const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
          ctx.game.earthbendLand(target.objectId, expCounters, ctx.controller);
        }
      }
    },
    { description: 'Whenever you attack, earthbend X, where X is the number of experience counters you have.' },
  )
  .build();
