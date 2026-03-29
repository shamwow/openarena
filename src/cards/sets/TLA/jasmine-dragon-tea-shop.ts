import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const JasmineDragonTeaShop = CardBuilder.create('Jasmine Dragon Tea Shop')
  .types(CardType.LAND)
  .tapForMana('C')
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add (for Ally spells)',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
      // TODO: Restrict this mana to Ally spells and Ally abilities only
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{T}: Add one mana of any color. Spend this mana only to cast an Ally spell or activate an ability of an Ally source.',
    },
  )
  .activated(
    { mana: parseManaCost('{5}'), tap: true },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    { description: '{5}, {T}: Create a 1/1 white Ally creature token.' },
  )
  .build();
