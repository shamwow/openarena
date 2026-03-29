import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FieryConfluence = CardBuilder.create('Fiery Confluence')
  .cost('{2}{R}{R}')
  .types(CardType.SORCERY)
  .modal([
    {
      label: 'Fiery Confluence deals 1 damage to each creature.',
      effect: (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        for (const creature of creatures) {
          ctx.game.dealDamage(ctx.source.objectId, creature.objectId, 1, false);
        }
      },
    },
    {
      label: 'Fiery Confluence deals 2 damage to each opponent.',
      effect: (ctx) => {
        for (const opp of ctx.game.getOpponents(ctx.controller)) {
          ctx.game.dealDamage(ctx.source.objectId, opp, 2, false);
        }
      },
    },
    {
      label: 'Destroy target artifact.',
      effect: async (ctx) => {
        const artifacts = ctx.game.getBattlefield({ types: [CardType.ARTIFACT] });
        if (artifacts.length > 0) {
          const target = await ctx.choices.chooseOne('Destroy target artifact', artifacts, c => c.definition.name);
          ctx.game.destroyPermanent(target.objectId);
        }
      },
    },
  ], 3, 'Choose three. You may choose the same mode more than once.', { allowRepeatedModes: true })
  .build();
