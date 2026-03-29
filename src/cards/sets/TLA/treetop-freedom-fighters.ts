import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const TreetopFreedomFighters = CardBuilder.create('Treetop Freedom Fighters')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(2, 1)
  .haste()
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
