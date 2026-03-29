import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BuzzardWaspColony = CardBuilder.create('Buzzard-Wasp Colony')
  .cost('{3}{B}')
  .types(CardType.CREATURE)
  .subtypes('Bird', 'Insect')
  .stats(2, 2)
  .flying()
  .etbEffect(async (ctx) => {
    const sacrificeable = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller)
      .filter(c => c.objectId !== ctx.source.objectId &&
        (c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.CREATURE)));
    if (sacrificeable.length > 0) {
      const doSac = await ctx.choices.chooseYesNo('Sacrifice an artifact or creature to draw a card?');
      if (doSac) {
        const target = await ctx.choices.chooseOne('Sacrifice an artifact or creature', sacrificeable, c => c.definition.name);
        ctx.game.sacrificePermanent(target.objectId, ctx.controller);
        ctx.game.drawCards(ctx.controller, 1);
      }
    }
  }, { description: 'When this creature enters, you may sacrifice an artifact or creature. If you do, draw a card.' })
  .triggered(
    { on: 'dies', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      if (ctx.event && 'objectId' in ctx.event && (ctx.event as any).objectId === ctx.source.objectId) return;
      // Check if the died creature had counters
      const diedCard = ctx.event && 'lastKnownInformation' in ctx.event ? (ctx.event as any).lastKnownInformation : null;
      if (!diedCard) return;
      const counters = diedCard.counters ?? {};
      const hasCounters = Object.values(counters).some((v: any) => v > 0);
      if (hasCounters) {
        for (const [type, amount] of Object.entries(counters)) {
          if ((amount as number) > 0) {
            ctx.game.addCounters(ctx.source.objectId, type, amount as number, {
              player: ctx.controller,
              sourceId: ctx.source.objectId,
              sourceCardId: ctx.source.cardId,
              sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
            });
          }
        }
      }
    },
    { description: 'Whenever another creature you control dies, if it had counters on it, put its counters on this creature.' }
  )
  .build();
