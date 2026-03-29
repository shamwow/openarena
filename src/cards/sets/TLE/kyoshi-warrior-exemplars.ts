import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KyoshiWarriorExemplars = CardBuilder.create('Kyoshi Warrior Exemplars')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(4, 3)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length >= 8) {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        ctx.game.grantPumpToObjectsUntilEndOfTurn(
          creatures.map(c => c.objectId),
          2,
          2,
        );
      }
    },
    { description: 'Whenever this creature attacks, if you control eight or more lands, creatures you control get +2/+2 until end of turn.' },
  )
  .build();
