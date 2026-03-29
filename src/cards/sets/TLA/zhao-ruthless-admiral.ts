import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ZhaoRuthlessAdmiral = CardBuilder.create('Zhao, Ruthless Admiral')
  .cost('{2}{B/R}{B/R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Soldier')
  .stats(3, 4)
  .firebending(2)
  .triggered(
    { on: 'sacrifice', filter: { controller: 'you', self: false } },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      ctx.game.grantPumpToObjectsUntilEndOfTurn(creatures.map(c => c.objectId), 1, 0);
    },
    { description: 'Whenever you sacrifice another permanent, creatures you control get +1/+0 until end of turn.' },
  )
  .build();
