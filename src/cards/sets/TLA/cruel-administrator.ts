import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';
import { createFirebendingTriggeredAbility } from '../../firebending';

export const CruelAdministrator = CardBuilder.create('Cruel Administrator')
  .cost('{3}{B}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(5, 4)
  .etbEffect((ctx) => {
    const attackedThisTurn = ctx.state.eventLog.some(
      (e: any) => e.type === 'ATTACKS' && e.lastKnownInfo?.controller === ctx.controller,
    );
    if (attackedThisTurn) {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    }
  }, { description: 'Raid — When Cruel Administrator enters, if you attacked this turn, put a +1/+1 counter on it.' })
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Soldier',
        types: [CardType.CREATURE as any],
        subtypes: ['Soldier'],
        power: 2,
        toughness: 2,
        colorIdentity: [ManaColor.RED],
        abilities: [createFirebendingTriggeredAbility(1)],
      });
    },
    { description: 'Whenever Cruel Administrator attacks, create a 2/2 red Soldier creature token with firebending 1.' },
  )
  .build();
