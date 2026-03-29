import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const PriceOfFreedom = CardBuilder.create('Price of Freedom')
  .cost('{1}{R}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(
      c => (c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.LAND)) && c.controller !== ctx.controller,
    );
    if (targets.length > 0) {
      const target = await ctx.choices.chooseOne('Destroy target artifact or land an opponent controls', targets, c => c.definition.name);
      const targetController = target.controller;
      ctx.game.destroyPermanent(target.objectId);
      // Controller may search for a basic land
      await ctx.game.searchLibraryWithOptions({
        player: targetController,
        filter: { types: [CardType.LAND], supertypes: ['Basic'] },
        destination: 'BATTLEFIELD',
        count: 1,
        tapped: true,
      });
    }
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Destroy target artifact or land an opponent controls. Its controller may search their library for a basic land card, put it onto the battlefield tapped, then shuffle. Draw a card.' })
  .build();
