import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const BloodchiefAscension = CardBuilder.create('Bloodchief Ascension')
  .cost('{B}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'end-step', whose: 'each' },
    async (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      const anyLost2 = opponents.some(opp => {
        const lifeLost = ctx.state.eventLog?.filter(
          e => e.type === GameEventType.LIFE_LOST && 'player' in e && e.player === opp && e.turn === ctx.state.turn
        ).reduce((sum, e) => sum + (('amount' in e ? (e as any).amount : 0) as number), 0) ?? 0;
        return lifeLost >= 2;
      });
      if (anyLost2) {
        ctx.game.addCounters(ctx.source.objectId, 'quest', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { optional: true, description: 'At the beginning of each end step, if an opponent lost 2 or more life this turn, you may put a quest counter on this enchantment.' }
  )
  // TODO: Whenever a card is put into an opponent's graveyard, if 3+ quest counters, opponent loses 2 life and you gain 2 life
  .triggered(
    {
      on: 'custom',
      match: (event, source, _game) => {
        if (event.type !== GameEventType.ZONE_CHANGE) return false;
        if (!('toZone' in event) || (event as any).toZone !== 'GRAVEYARD') return false;
        const questCounters = source.counters['quest'] ?? 0;
        return questCounters >= 3;
      },
    },
    async (ctx) => {
      const opponents = ctx.game.getOpponents(ctx.controller);
      for (const opp of opponents) {
        ctx.game.loseLife(opp, 2);
      }
      ctx.game.gainLife(ctx.controller, 2);
    },
    { optional: true, description: 'Whenever a card is put into an opponent\'s graveyard, if 3+ quest counters, that player loses 2 life and you gain 2 life.' }
  )
  .build();
