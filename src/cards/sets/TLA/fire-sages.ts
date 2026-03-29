import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FireSages = CardBuilder.create('Fire Sages')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Cleric')
  .stats(2, 2)
  .firebending(1)
  .activated(
    { mana: parseManaCost('{1}{R}{R}') },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
    },
    { description: '{1}{R}{R}: Put a +1/+1 counter on this creature.' },
  )
  .build();
