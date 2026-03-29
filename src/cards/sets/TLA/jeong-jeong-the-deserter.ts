import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const JeongJeongTheDeserter = CardBuilder.create('Jeong Jeong, the Deserter')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(2, 3)
  .firebending(1)
  .activated(
    { mana: parseManaCost('{3}') },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
      // TODO: When you next cast a Lesson spell this turn, copy it and you may choose new targets for the copy
    },
    {
      isExhaust: true,
      description: 'Exhaust \u2014 {3}: Put a +1/+1 counter on Jeong Jeong. When you next cast a Lesson spell this turn, copy it and you may choose new targets for the copy.',
    },
  )
  .build();
