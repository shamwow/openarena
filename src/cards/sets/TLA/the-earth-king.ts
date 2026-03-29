import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const TheEarthKing = CardBuilder.create('The Earth King')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Bear',
      types: [CardType.CREATURE],
      subtypes: ['Bear'],
      power: 4,
      toughness: 4,
      colorIdentity: [ManaColor.GREEN],
    });
  }, { description: 'When The Earth King enters, create a 4/4 green Bear creature token.' })
  .triggered(
    { on: 'attacks', filter: { types: [CardType.CREATURE], controller: 'you', power: { op: 'gte', value: 4 } } },
    async (ctx) => {
      const bigAttackers = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you', tapped: true }, ctx.controller)
        .filter(c => (c.modifiedPower ?? c.definition.power ?? 0) >= 4);
      const count = bigAttackers.length;
      if (count > 0) {
        await ctx.game.searchLibraryWithOptions({
          player: ctx.controller,
          filter: { supertypes: ['Basic'], types: [CardType.LAND] },
          destination: 'BATTLEFIELD',
          count,
          tapped: true,
        });
      }
    },
    { description: 'Whenever one or more creatures you control with power 4 or greater attack, search your library for up to that many basic land cards, put them onto the battlefield tapped, then shuffle.' },
  )
  .build();
