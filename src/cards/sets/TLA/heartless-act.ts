import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const HeartlessAct = CardBuilder.create('Heartless Act')
  .cost('{1}{B}')
  .types(CardType.INSTANT)
  .modal([
    {
      label: 'Destroy target creature with no counters on it',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
          .filter(c => {
            const counters = c.counters ?? {};
            return Object.values(counters).every(v => v === 0);
          });
        if (creatures.length === 0) return;
        const target = await ctx.choices.chooseOne('Destroy target creature with no counters', creatures, c => c.definition.name);
        ctx.game.destroyPermanent(target.objectId);
      },
    },
    {
      label: 'Remove up to three counters from target creature',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length === 0) return;
        const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
        // TODO: Allow choosing which counters to remove
        const counters = target.counters ?? {};
        let remaining = 3;
        for (const [type, count] of Object.entries(counters)) {
          if (remaining <= 0) break;
          const toRemove = Math.min(count as number, remaining);
          ctx.game.addCounters(target.objectId, type, -toRemove);
          remaining -= toRemove;
        }
      },
    },
  ], 1, 'Choose one \u2014')
  .build();
