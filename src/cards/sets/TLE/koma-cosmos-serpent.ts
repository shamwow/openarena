import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const KomaCosmosSerpent = CardBuilder.create('Koma, Cosmos Serpent')
  .cost('{3}{G}{G}{U}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Serpent')
  .stats(6, 6)
  // TODO: This spell can't be countered
  .triggered(
    { on: 'upkeep', whose: 'each' },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: "Koma's Coil",
        types: [CardType.CREATURE],
        subtypes: ['Serpent'],
        power: 3,
        toughness: 3,
        colorIdentity: [ManaColor.BLUE],
      });
    },
    { description: "At the beginning of each upkeep, create a 3/3 blue Serpent creature token named Koma's Coil." },
  )
  .activated(
    { sacrifice: { filter: { subtypes: ['Serpent'], controller: 'you', self: false }, count: 1 } },
    async (ctx) => {
      const modes = [
        { label: 'Tap target permanent', effect: async (innerCtx: typeof ctx) => {
          const permanents = innerCtx.game.getBattlefield();
          if (permanents.length > 0) {
            const target = await innerCtx.choices.chooseOne('Choose target permanent to tap', permanents, c => c.definition.name);
            innerCtx.game.tapPermanent(target.objectId);
            // TODO: Its activated abilities can't be activated this turn
          }
        }},
        { label: 'Koma gains indestructible until end of turn', effect: async (innerCtx: typeof ctx) => {
          // TODO: Grant indestructible until end of turn
        }},
      ];
      const chosen = await ctx.choices.chooseOne('Choose one', modes, m => m.label);
      await chosen.effect(ctx);
    },
    {
      timing: 'instant',
      description: "Sacrifice another Serpent: Choose one -- Tap target permanent. Its activated abilities can't be activated this turn. -- Koma gains indestructible until end of turn.",
    },
  )
  .build();
