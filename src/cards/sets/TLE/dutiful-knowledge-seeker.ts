import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const DutifulKnowledgeSeeker = CardBuilder.create('Dutiful Knowledge Seeker')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Fox', 'Spirit')
  .stats(2, 2)
  .triggered(
    {
      on: 'custom',
      match: (event) => {
        // Whenever one or more cards are put into a library from anywhere
        return event.type === GameEventType.ZONE_CHANGE && (event as any).toZone === 'LIBRARY';
      },
    },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { oncePerTurn: true, description: 'Whenever one or more cards are put into a library from anywhere, put a +1/+1 counter on this creature.' }
  )
  .activated(
    { mana: { generic: 3, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 } },
    async (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      const allPlayers = [ctx.controller, ...opponents];
      for (const player of allPlayers) {
        const graveyard = ctx.game.getGraveyard(player);
        if (graveyard.length > 0) {
          const target = await ctx.choices.chooseOne(`Choose a card from ${player}'s graveyard`, graveyard, c => c.definition.name);
          ctx.game.moveCard(target.objectId, 'LIBRARY_BOTTOM', player);
          return;
        }
      }
    },
    { description: "{3}: Put target card from a graveyard on the bottom of its owner's library." }
  )
  .build();
