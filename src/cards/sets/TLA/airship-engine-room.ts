import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AirshipEngineRoom = CardBuilder.create('Airship Engine Room')
  .types(CardType.LAND)
  .entersTapped()
  .activated(
    { tap: true },
    async (ctx) => {
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['U', 'R'] as const,
        (c) => ({ U: 'Blue', R: 'Red' }[c]),
      );
      ctx.game.addMana(ctx.controller, color, 1);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['U', 'R'] }],
      description: '{T}: Add {U} or {R}.',
    },
  )
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' }
  )
  .build();
