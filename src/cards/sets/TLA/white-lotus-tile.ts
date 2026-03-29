import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WhiteLotusTile = CardBuilder.create('White Lotus Tile')
  .cost('{4}')
  .types(CardType.ARTIFACT)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      // Find the greatest number of creatures sharing a creature type
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const typeCounts: Record<string, number> = {};
      for (const creature of creatures) {
        for (const subtype of creature.definition.subtypes ?? []) {
          typeCounts[subtype] = (typeCounts[subtype] ?? 0) + 1;
        }
      }
      const maxShared = Math.max(0, ...Object.values(typeCounts));
      if (maxShared > 0) {
        const color = await ctx.choices.chooseOne(
          `Add ${maxShared} mana of any one color`,
          ['W', 'U', 'B', 'R', 'G'] as const,
          (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
        );
        ctx.game.addMana(ctx.controller, color, maxShared);
      }
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{T}: Add X mana of any one color, where X is the greatest number of creatures you control that have a creature type in common.',
    },
  )
  .build();
