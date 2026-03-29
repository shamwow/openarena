import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HermiticHerbalist = CardBuilder.create('Hermitic Herbalist')
  .cost('{G}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Druid', 'Ally')
  .stats(2, 3)
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{T}: Add one mana of any color.',
    },
  )
  .activated(
    { tap: true },
    async (ctx) => {
      // Add two mana in any combination, but only for Lesson spells
      for (let i = 0; i < 2; i++) {
        const color = await ctx.choices.chooseOne(
          `Choose mana color (${i + 1}/2) for Lesson spells`,
          ['W', 'U', 'B', 'R', 'G'] as const,
          (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
        );
        ctx.game.addMana(ctx.controller, color, 1);
        // TODO: Restrict this mana to Lesson spells only
      }
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 2, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{T}: Add two mana in any combination of colors. Spend this mana only to cast Lesson spells.',
    },
  )
  .build();
