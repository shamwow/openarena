import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WaterTribeCaptain = CardBuilder.create('Water Tribe Captain')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(3, 3)
  .activated(
    { mana: parseManaCost('{5}') },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const ids = creatures.map(c => c.objectId);
      ctx.game.grantPumpToObjectsUntilEndOfTurn(ids, 1, 1);
    },
    { description: '{5}: Creatures you control get +1/+1 until end of turn.' },
  )
  .build();
