import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const IrohsDemonstration = CardBuilder.create("Iroh's Demonstration")
  .cost('{1}{R}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .modal([
    {
      label: "Iroh's Demonstration deals 1 damage to each creature your opponents control",
      effect: (ctx) => {
        const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
          .filter(c => c.controller !== ctx.controller);
        for (const creature of oppCreatures) {
          ctx.game.dealDamage(ctx.source.objectId, creature.objectId, 1, false);
        }
      },
    },
    {
      label: "Iroh's Demonstration deals 4 damage to target creature",
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length === 0) return;
        const target = await ctx.choices.chooseOne('Deal 4 damage to target creature', creatures, c => c.definition.name);
        ctx.game.dealDamage(ctx.source.objectId, target.objectId, 4, false);
      },
    },
  ], 1, 'Choose one \u2014')
  .build();
