import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, GameEventType } from '../../../engine/types';

export const ZukoAvatarHunter = CardBuilder.create('Zuko, Avatar Hunter')
  .cost('{3}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(4, 5)
  .reach()
  .triggered(
    {
      on: 'cast-spell',
      filter: { colors: [ManaColor.RED], controller: 'you' },
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Soldier',
        types: [CardType.CREATURE],
        subtypes: ['Soldier'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.RED],
      });
    },
    { description: 'Whenever you cast a red spell, create a 2/2 red Soldier creature token.' },
  )
  .build();
