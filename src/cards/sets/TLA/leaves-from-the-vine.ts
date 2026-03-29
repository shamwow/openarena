import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const LeavesFromTheVine = CardBuilder.create('Leaves from the Vine')
  .cost('{1}{G}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: (ctx) => {
        ctx.game.mill(ctx.controller, 3);
        ctx.game.createPredefinedToken(ctx.controller, 'Food');
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length > 0) {
          const chosen = await ctx.choices.chooseUpToN('Choose up to two target creatures you control', creatures, 2, c => c.definition.name);
          for (const target of chosen) {
            ctx.game.addCounters(target.objectId, '+1/+1', 1);
          }
        }
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        const graveyard = ctx.game.getGraveyard(ctx.controller);
        const hasCreatureOrLesson = graveyard.some(
          c => c.definition.types.includes(CardType.CREATURE) || c.definition.subtypes.includes('Lesson'),
        );
        if (hasCreatureOrLesson) {
          ctx.game.drawCards(ctx.controller, 1);
        }
      },
    },
  ])
  .build();
