import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WanderingMusicians = CardBuilder.create('Wandering Musicians')
  .cost('{3}{R/W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Bard', 'Ally')
  .stats(2, 5)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      ctx.game.grantPumpToObjectsUntilEndOfTurn(creatures.map(c => c.objectId), 1, 0);
    },
    { description: 'Whenever this creature attacks, creatures you control get +1/+0 until end of turn.' },
  )
  .build();
