import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WhiteLotusHideout = CardBuilder.create('White Lotus Hideout')
  .types(CardType.LAND)
  .tapForMana('C')
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add (for Lesson or Shrine spells only)',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      // TODO: Restrict to only Lesson or Shrine spells
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{T}: Add one mana of any color. Spend this mana only to cast a Lesson or Shrine spell.',
    },
  )
  .activated(
    { mana: parseManaCost('{1}'), tap: true },
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
      description: '{1}, {T}: Add one mana of any color.',
    },
  )
  .build();
