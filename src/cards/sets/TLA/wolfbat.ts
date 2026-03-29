import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const Wolfbat = CardBuilder.create('Wolfbat')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Wolf', 'Bat')
  .stats(2, 2)
  .flying()
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        // Triggers from graveyard when you draw your second card each turn
        if (source.zone !== 'GRAVEYARD') return false;
        if (event.type !== GameEventType.DREW_CARD) return false;
        if (!('player' in event)) return false;
        const drawEvent = event as typeof event & { player: string };
        if (drawEvent.player !== source.controller) return false;
        const drawsThisTurn = game.eventLog.filter(
          e => e.type === GameEventType.DREW_CARD &&
            'player' in e && (e as typeof e & { player: string }).player === source.controller &&
            e.timestamp >= (game.turnStartTimestamp ?? 0),
        );
        return drawsThisTurn.length === 2;
      },
    },
    async (ctx) => {
      const wantPay = await ctx.choices.chooseYesNo('Pay {B} to return Wolfbat from graveyard to the battlefield?');
      if (wantPay) {
        // TODO: Actually pay {B}. Return with a finality counter.
        ctx.game.moveCard(ctx.source.objectId, 'BATTLEFIELD', ctx.controller);
        ctx.game.addCounters(ctx.source.objectId, 'finality', 1);
      }
    },
    { optional: true, description: 'Whenever you draw your second card each turn, you may pay {B}. If you do, return this card from your graveyard to the battlefield with a finality counter on it.' },
  )
  .build();
