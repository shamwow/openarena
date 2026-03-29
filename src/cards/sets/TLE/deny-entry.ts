import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DenyEntry = CardBuilder.create('Deny Entry')
  .cost('{2}{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const stackSpells = ctx.state.stack.filter(
      e => e.entryType === 'SPELL' && e.cardInstance?.definition.types.includes(CardType.CREATURE)
    );
    if (stackSpells.length > 0) {
      const target = await ctx.choices.chooseOne(
        'Counter target creature spell',
        stackSpells,
        e => e.cardInstance?.definition.name ?? 'Unknown spell'
      );
      ctx.game.counterSpell(target.id);
    }
    ctx.game.drawCards(ctx.controller, 1);
    // Discard a card
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length > 0) {
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
    }
  }, { description: 'Counter target creature spell. Draw a card, then discard a card.' })
  .build();
