import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TophTheFirstMetalbender = CardBuilder.create('Toph, the First Metalbender')
  .cost('{1}{R}{G}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .staticAbility(
    {
      type: 'add-types',
      types: [CardType.LAND],
      filter: {
        types: [CardType.ARTIFACT],
        controller: 'you',
        custom: (card) => !card.isToken,
      },
    },
    { description: 'Nontoken artifacts you control are lands in addition to their other types.' },
  )
  .triggered(
    { on: 'end-step', whose: 'yours' },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
      }
    },
    { description: 'At the beginning of your end step, earthbend 2.' },
  )
  .build();
