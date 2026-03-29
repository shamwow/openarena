import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireLordOzai = CardBuilder.create('Fire Lord Ozai')
  .cost('{3}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(4, 4)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId);
      if (creatures.length === 0) return;
      const doSacrifice = await ctx.choices.chooseYesNo('Sacrifice another creature for mana?');
      if (doSacrifice) {
        const toSac = await ctx.choices.chooseOne('Choose a creature to sacrifice', creatures, c => c.definition.name);
        const power = toSac.modifiedPower ?? toSac.definition.power ?? 0;
        ctx.game.destroyPermanent(toSac.objectId);
        ctx.game.addMana(ctx.controller, 'R', power);
      }
    },
    { description: 'Whenever Fire Lord Ozai attacks, you may sacrifice another creature. If you do, add an amount of {R} equal to the sacrificed creature\'s power. Until end of combat, you don\'t lose this mana as steps end.' }
  )
  .activated(
    { mana: { generic: 6, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 } },
    async (ctx) => {
      // Exile top card of each opponent's library
      const opponents = ctx.game.getOpponents(ctx.controller);
      const exiled: any[] = [];
      for (const opp of opponents) {
        const library = ctx.game.getLibrary(opp);
        if (library.length > 0) {
          const topCard = library[0];
          ctx.game.moveCard(topCard.objectId, 'EXILE', opp);
          exiled.push(topCard);
        }
      }
      // TODO: Until end of turn, you may play one of those cards without paying its mana cost
      if (exiled.length > 0) {
        // Simplified: just exile for now
      }
    },
    { description: "{6}: Exile the top card of each opponent's library. Until end of turn, you may play one of those cards without paying its mana cost." }
  )
  .build();
