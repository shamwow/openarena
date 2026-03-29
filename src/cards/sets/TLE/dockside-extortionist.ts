import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DocksideExtortionist = CardBuilder.create('Dockside Extortionist')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Goblin', 'Pirate')
  .stats(1, 2)
  .etbEffect((ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    let count = 0;
    for (const opp of opponents) {
      const permanents = ctx.game.getBattlefield(undefined, opp);
      count += permanents.filter(c =>
        c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.ENCHANTMENT)
      ).length;
    }
    for (let i = 0; i < count; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Treasure',
        types: [CardType.ARTIFACT],
        subtypes: ['Treasure'],
        abilities: [{
          kind: 'activated' as const,
          cost: { tap: true, sacrifice: { self: true } },
          effect: async (innerCtx) => {
            const colors: Array<'W' | 'U' | 'B' | 'R' | 'G'> = ['W', 'U', 'B', 'R', 'G'];
            const color = await innerCtx.choices.chooseOne('Choose a color of mana', colors, c => c);
            innerCtx.game.addMana(innerCtx.controller, color, 1);
          },
          timing: 'instant' as const,
          isManaAbility: true,
          description: '{T}, Sacrifice this token: Add one mana of any color.',
        }],
      });
    }
  }, { description: 'When this creature enters, create X Treasure tokens, where X is the number of artifacts and enchantments your opponents control.' })
  .build();
