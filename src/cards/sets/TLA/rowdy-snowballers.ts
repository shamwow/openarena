import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RowdySnowballers = CardBuilder.create('Rowdy Snowballers')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.controller !== ctx.controller);
    if (oppCreatures.length > 0) {
      const target = await ctx.choices.chooseOne('Tap target creature an opponent controls', oppCreatures, c => c.definition.name);
      ctx.game.tapPermanent(target.objectId);
      ctx.game.addCounters(target.objectId, 'stun', 1);
    }
  }, { description: 'When this creature enters, tap target creature an opponent controls and put a stun counter on it.' })
  .build();
