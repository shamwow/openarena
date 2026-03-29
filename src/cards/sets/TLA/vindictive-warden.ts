import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const VindictiveWarden = CardBuilder.create('Vindictive Warden')
  .cost('{2}{B/R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(2, 3)
  .menace()
  .firebending(1)
  .activated(
    { mana: parseManaCost('{3}') },
    (ctx) => {
      for (const opponent of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.dealDamage(ctx.source.objectId, opponent, 1, false);
      }
    },
    { description: '{3}: This creature deals 1 damage to each opponent.' },
  )
  .build();
