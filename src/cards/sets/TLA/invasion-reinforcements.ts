import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const InvasionReinforcements = CardBuilder.create('Invasion Reinforcements')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(1, 1)
  .flash()
  .etbEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
  }, { description: 'When this creature enters, create a 1/1 white Ally creature token.' })
  .build();
