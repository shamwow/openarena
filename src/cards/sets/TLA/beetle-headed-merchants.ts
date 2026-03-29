import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BeetleHeadedMerchants = CardBuilder.create('Beetle-Headed Merchants')
  .cost('{4}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(5, 4)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const sacrificeable = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId &&
          (c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes(CardType.ARTIFACT)));
      if (sacrificeable.length > 0) {
        const doSac = await ctx.choices.chooseYesNo('Sacrifice another creature or artifact?');
        if (doSac) {
          const target = await ctx.choices.chooseOne('Sacrifice a creature or artifact', sacrificeable, c => c.definition.name);
          ctx.game.sacrificePermanent(target.objectId, ctx.controller);
          ctx.game.drawCards(ctx.controller, 1);
          ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
            player: ctx.controller,
            sourceId: ctx.source.objectId,
            sourceCardId: ctx.source.cardId,
            sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
          });
        }
      }
    },
    { description: 'Whenever this creature attacks, you may sacrifice another creature or artifact. If you do, draw a card and put a +1/+1 counter on this creature.' }
  )
  .build();
