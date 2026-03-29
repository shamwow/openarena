import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const PlanetariumOfWanShiTong = CardBuilder.create('Planetarium of Wan Shi Tong')
  .cost('{6}')
  .types(CardType.ARTIFACT)
  .supertypes('Legendary')
  .activated(
    { mana: parseManaCost('{1}'), tap: true },
    async (ctx) => {
      await ctx.game.scry(ctx.controller, 2);
    },
    { description: '{1}, {T}: Scry 2.' },
  )
  // TODO: "Whenever you scry or surveil, look at the top card of your library. You may cast that card without paying its mana cost. Do this only once each turn."
  // Requires tracking scry/surveil events and free-cast mechanic
  .triggered(
    {
      on: 'custom',
      match: (event) => event.type === 'SCRY' || event.type === 'SURVEIL',
    },
    async (ctx) => {
      // Simplified: just draw a card as placeholder
      // TODO: should be "look at top, may cast without paying mana cost, once per turn"
    },
    {
      oncePerTurn: true,
      description: 'Whenever you scry or surveil, look at the top card of your library. You may cast that card without paying its mana cost. Do this only once each turn.',
    },
  )
  .build();
