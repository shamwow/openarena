import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SokkasHaiku = CardBuilder.create("Sokka's Haiku")
  .cost('{3}{U}{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Counter target spell
    const stack = ctx.state.stack;
    if (stack.length > 0) {
      const spellEntries = stack.filter(e => e.objectId !== ctx.source.objectId);
      if (spellEntries.length > 0) {
        const target = await ctx.choices.chooseOne('Counter target spell', spellEntries, e => e.definition?.name ?? 'Unknown');
        ctx.game.counterSpell(target.objectId);
      }
    }
    // Draw a card, then mill three
    ctx.game.drawCards(ctx.controller, 1);
    ctx.game.mill(ctx.controller, 3);
    // Untap target land
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND] });
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Untap target land', lands, c => c.definition.name);
      ctx.game.untapPermanent(target.objectId);
    }
  }, { description: 'Counter target spell. Draw a card, then mill three cards. Untap target land.' })
  .build();
