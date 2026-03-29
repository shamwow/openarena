import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const FireNationArchers = CardBuilder.create('Fire Nation Archers')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Archer')
  .stats(3, 4)
  .reach()
  .activated(
    { mana: { generic: 5, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 } },
    (ctx) => {
      for (const opp of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.dealDamage(ctx.source.objectId, opp, 2, false);
      }
      ctx.game.createToken(ctx.controller, {
        name: 'Soldier',
        types: [CardType.CREATURE],
        subtypes: ['Soldier'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.RED],
      });
    },
    { description: '{5}: This creature deals 2 damage to each opponent. Create a 2/2 red Soldier creature token.' }
  )
  .build();
