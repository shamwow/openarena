import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ThatsRoughBuddy = CardBuilder.create("That's Rough Buddy")
  .cost('{1}{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
      // TODO: Check if a creature left the battlefield under your control this turn for +2 instead of +1
      ctx.game.addCounters(target.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: "Put a +1/+1 counter on target creature. Put two +1/+1 counters on that creature instead if a creature left the battlefield under your control this turn. Draw a card." })
  .build();
