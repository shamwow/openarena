import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const TheCaveOfTwoLovers = CardBuilder.create('The Cave of Two Lovers')
  .cost('{3}{R}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: async (ctx) => {
        ctx.game.createToken(ctx.controller, {
          name: 'Ally',
          types: [CardType.CREATURE],
          subtypes: ['Ally'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.WHITE],
        });
        ctx.game.createToken(ctx.controller, {
          name: 'Ally',
          types: [CardType.CREATURE],
          subtypes: ['Ally'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.WHITE],
        });
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        await ctx.game.searchLibraryWithOptions({
          player: ctx.controller,
          filter: { types: [CardType.LAND], subtypes: ['Mountain', 'Cave'] },
          destination: 'HAND',
          count: 1,
        });
      },
    },
    {
      chapter: 3,
      effect: async (ctx) => {
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        if (lands.length > 0) {
          const target = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands, c => c.definition.name);
          ctx.game.earthbendLand(target.objectId, 3, ctx.controller);
        }
      },
    },
  ])
  .build();
