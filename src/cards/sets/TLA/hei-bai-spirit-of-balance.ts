import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HeiBaiSpiritOfBalance = CardBuilder.create('Hei Bai, Spirit of Balance')
  .cost('{2}{W/B}{W/B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bear', 'Spirit')
  .stats(3, 3)
  .triggered(
    { on: 'enter-battlefield', filter: { self: true } },
    async (ctx) => {
      const sacrificeTargets = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller).filter(
        c => c.objectId !== ctx.source.objectId &&
          (c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes(CardType.ARTIFACT)),
      );
      if (sacrificeTargets.length === 0) return;
      const wantSac = await ctx.choices.chooseYesNo('Sacrifice another creature or artifact to put two +1/+1 counters on Hei Bai?');
      if (!wantSac) return;
      const target = await ctx.choices.chooseOne('Choose a creature or artifact to sacrifice', sacrificeTargets, c => c.definition.name);
      ctx.game.sacrificePermanent(target.objectId, ctx.controller);
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 2, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { optional: true, description: 'Whenever Hei Bai enters or attacks, you may sacrifice another creature or artifact. If you do, put two +1/+1 counters on Hei Bai.' },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const sacrificeTargets = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller).filter(
        c => c.objectId !== ctx.source.objectId &&
          (c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes(CardType.ARTIFACT)),
      );
      if (sacrificeTargets.length === 0) return;
      const wantSac = await ctx.choices.chooseYesNo('Sacrifice another creature or artifact to put two +1/+1 counters on Hei Bai?');
      if (!wantSac) return;
      const target = await ctx.choices.chooseOne('Choose a creature or artifact to sacrifice', sacrificeTargets, c => c.definition.name);
      ctx.game.sacrificePermanent(target.objectId, ctx.controller);
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 2, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { optional: true, description: 'Whenever Hei Bai enters or attacks, you may sacrifice another creature or artifact. If you do, put two +1/+1 counters on Hei Bai.' },
  )
  .triggered(
    { on: 'leaves-battlefield', filter: { self: true } },
    async (ctx) => {
      // TODO: Move the actual counters from Hei Bai to target creature
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne(
        'Put Hei Bai\'s counters on target creature you control',
        creatures,
        c => c.definition.name,
      );
      const counterCount = ctx.source.counters['+1/+1'] ?? 0;
      if (counterCount > 0) {
        ctx.game.addCounters(target.objectId, '+1/+1', counterCount, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { description: 'When Hei Bai leaves the battlefield, put its counters on target creature you control.' },
  )
  .build();
