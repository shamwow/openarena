import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const SunWarriors = CardBuilder.create('Sun Warriors')
  .cost('{2}{R}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 5)
  // Firebending X where X is number of creatures you control
  // TODO: Dynamic firebending amount based on creature count
  .firebending(1)
  .activated(
    { mana: parseManaCost('{5}') },
    async (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    { description: '{5}: Create a 1/1 white Ally creature token.' },
  )
  .build();
