import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TarnishedCitadel = CardBuilder.create('Tarnished Citadel')
  .types(CardType.LAND)
  .tapForMana('C')
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        (c) => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
      ctx.game.dealDamage(ctx.source.objectId, ctx.controller, 3, false);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['W', 'U', 'B', 'R', 'G'] }],
      description: '{T}: Add one mana of any color. This land deals 3 damage to you.',
    },
  )
  .build();
