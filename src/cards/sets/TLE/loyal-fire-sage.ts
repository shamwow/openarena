import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const LoyalFireSage = CardBuilder.create('Loyal Fire Sage')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Cleric', 'Ally')
  .stats(3, 3)
  .firebending(1)
  .activated(
    { mana: parseManaCost('{5}') },
    (ctx) => {
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
