import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DaiLiCensor = CardBuilder.create('Dai Li Censor')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Advisor')
  .stats(2, 1)
  .activated(
    {
      mana: { generic: 1, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 },
      sacrifice: { filter: { types: [CardType.CREATURE], controller: 'you', self: false } },
    },
    (ctx) => {
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 2, 2);
    },
    { timing: 'instant', description: '{1}, Sacrifice another creature: This creature gets +2/+2 until end of turn. Activate only once each turn.' }
  )
  .build();
