import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const PretendingPoxbearers = CardBuilder.create('Pretending Poxbearers')
  .cost('{1}{W/B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen', 'Ally')
  .stats(2, 1)
  .diesEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
  }, { description: 'When this creature dies, create a 1/1 white Ally creature token.' })
  .build();
