import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const BroughtBack = CardBuilder.create('Brought Back')
  .cost('{W}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // Find permanent cards that were put into graveyard from battlefield this turn
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const eligibleCards = graveyard.filter(c => {
      // Check if this card went to graveyard from battlefield this turn
      const events = ctx.state.eventLog?.filter(
        e => e.type === GameEventType.ZONE_CHANGE &&
        'objectId' in e && (e as any).objectId === c.objectId &&
        'fromZone' in e && (e as any).fromZone === 'BATTLEFIELD' &&
        'toZone' in e && (e as any).toZone === 'GRAVEYARD' &&
        e.turn === ctx.state.turn
      ) ?? [];
      return events.length > 0;
    });
    if (eligibleCards.length === 0) return;
    const chosen = await ctx.choices.chooseUpToN('Choose up to two permanent cards put into your graveyard from the battlefield this turn', eligibleCards, 2, c => c.definition.name);
    for (const card of chosen) {
      ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      // TODO: They should enter tapped
    }
  }, { description: 'Choose up to two target permanent cards in your graveyard that were put there from the battlefield this turn. Return them to the battlefield tapped.' })
  .build();
