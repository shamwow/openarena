import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const IrohFirebendingInstructor = CardBuilder.create('Iroh, Firebending Instructor')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(2, 2)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const attackingCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.attacking);
      ctx.game.grantPumpToObjectsUntilEndOfTurn(attackingCreatures.map(c => c.objectId), 1, 1);
    },
    { description: 'Whenever Iroh attacks, attacking creatures get +1/+1 until end of turn.' },
  )
  .build();
