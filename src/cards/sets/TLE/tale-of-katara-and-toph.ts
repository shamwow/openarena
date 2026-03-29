import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const TaleOfKataraAndToph = CardBuilder.create('Tale of Katara and Toph')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: [{
        kind: 'triggered' as const,
        trigger: {
          on: 'custom' as const,
          match: (event: any, source: any, game: any) => {
            if (event.type !== GameEventType.TAPPED) return false;
            if (event.objectId !== source.objectId) return false;
            // Check if this is the first tap this turn
            const tapCount = game.eventLog.filter(
              (e: any) => e.type === GameEventType.TAPPED
                && e.objectId === source.objectId
                && e.timestamp >= (game.turnStartTimestamp ?? 0),
            ).length;
            return tapCount === 1 && game.activePlayer === source.controller;
          },
        },
        effect: (ctx: any) => {
          ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
            player: ctx.controller,
            sourceId: ctx.source.objectId,
            sourceCardId: ctx.source.cardId,
            sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
          });
        },
        optional: false,
        isManaAbility: false,
        description: 'Whenever this creature becomes tapped for the first time during each of your turns, put a +1/+1 counter on it.',
      }],
      filter: {
        types: [CardType.CREATURE],
        controller: 'you',
      },
    },
    { description: 'Creatures you control have "Whenever this creature becomes tapped for the first time during each of your turns, put a +1/+1 counter on it."' },
  )
  .build();
