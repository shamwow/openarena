import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const BarrelsOfBlastingJelly = CardBuilder.create('Barrels of Blasting Jelly')
  .cost('{1}')
  .types(CardType.ARTIFACT)
  .activated(
    { mana: parseManaCost('{1}') },
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
      description: '{1}: Add one mana of any color. Activate only once each turn.',
    }
  )
  .activated(
    { mana: parseManaCost('{5}'), tap: true, sacrifice: { self: true } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Deal 5 damage to target creature', creatures, c => c.definition.name);
        ctx.game.dealDamage(ctx.source.objectId, target.objectId, 5, false);
      }
    },
    { description: '{5}, {T}, Sacrifice this artifact: It deals 5 damage to target creature.' }
  )
  .build();
