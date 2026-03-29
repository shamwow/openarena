import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const GiantFly = CardBuilder.create('Giant Fly')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Insect')
  .stats(2, 2)
  .flying()
  // TODO: Whenever you sacrifice another permanent, this creature gets +1/+0 until end of turn
  .triggered(
    { on: 'sacrifice', filter: { controller: 'you', self: false } },
    (ctx) => {
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 1, 0);
    },
    { description: 'Whenever you sacrifice another permanent, this creature gets +1/+0 until end of turn.' },
  )
  .build();
