import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SeismicSense = CardBuilder.create('Seismic Sense')
  .cost('{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    const x = lands.length;
    if (x === 0) return;
    const library = ctx.game.getLibrary(ctx.controller);
    const topCards = library.slice(0, x);
    const eligible = topCards.filter(c =>
      c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes(CardType.LAND)
    );
    if (eligible.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('You may reveal a creature or land card and put it into your hand', eligible, 1, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
      }
    }
    // Put the rest on the bottom in a random order
    const remaining = topCards.filter(c => !eligible.some(e => e.objectId === c.objectId) || eligible.length === 0);
    for (const card of remaining) {
      ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'Look at the top X cards of your library, where X is the number of lands you control. You may reveal a creature or land card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.' })
  .build();
