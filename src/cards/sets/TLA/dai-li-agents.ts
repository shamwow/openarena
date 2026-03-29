import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DaiLiAgents = CardBuilder.create('Dai Li Agents')
  .cost('{3}{B}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(3, 4)
  .etbEffect(async (ctx) => {
    // Earthbend 1, then earthbend 1
    const lands1 = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands1.length > 0) {
      const target1 = await ctx.choices.chooseOne('Choose a land to earthbend 1', lands1, c => c.definition.name);
      ctx.game.earthbendLand(target1.objectId, 1, ctx.controller);
    }
    const lands2 = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands2.length > 0) {
      const target2 = await ctx.choices.chooseOne('Choose a land to earthbend 1', lands2, c => c.definition.name);
      ctx.game.earthbendLand(target2.objectId, 1, ctx.controller);
    }
  }, { description: 'When this creature enters, earthbend 1, then earthbend 1.' })
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const withCounters = creatures.filter(c => (c.counters['+1/+1'] ?? 0) > 0);
      const x = withCounters.length;
      if (x > 0) {
        for (const opp of ctx.game.getOpponents(ctx.controller)) {
          ctx.game.loseLife(opp, x);
        }
        ctx.game.gainLife(ctx.controller, x);
      }
    },
    { description: 'Whenever this creature attacks, each opponent loses X life and you gain X life, where X is the number of creatures you control with +1/+1 counters on them.' }
  )
  .build();
