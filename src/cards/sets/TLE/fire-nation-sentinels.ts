import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const FireNationSentinels = CardBuilder.create('Fire Nation Sentinels')
  .cost('{3}{B}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(4, 4)
  .triggered(
    {
      on: 'custom',
      match: (event, source) => {
        if (event.type !== GameEventType.CREATURE_DIED) return false;
        if (event.controller === source.controller) return false;
        if (event.isToken) return false;
        return true;
      },
    },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      for (const creature of creatures) {
        ctx.game.addCounters(creature.objectId, '+1/+1', 1);
      }
    },
    { description: 'Whenever a nontoken creature an opponent controls dies, put a +1/+1 counter on each creature you control.' },
  )
  .build();
