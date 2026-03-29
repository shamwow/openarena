import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ChongAndLilyNomads = CardBuilder.create('Chong and Lily, Nomads')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Bard', 'Ally')
  .stats(3, 3)
  .triggered(
    { on: 'attacks', filter: { subtypes: ['Bard'], controller: 'you' } },
    async (ctx) => {
      const mode = await ctx.choices.chooseOne('Choose one', [
        'Put a lore counter on each Saga',
        'Pump creatures based on lore counters',
      ] as const, m => m);

      if (mode === 'Put a lore counter on each Saga') {
        const sagas = ctx.game.getBattlefield({ subtypes: ['Saga'], controller: 'you' }, ctx.controller);
        if (sagas.length > 0) {
          const chosen = await ctx.choices.chooseUpToN('Choose Sagas to add lore counters', sagas, sagas.length, c => c.definition.name);
          for (const saga of chosen) {
            ctx.game.addCounters(saga.objectId, 'lore', 1, {
              player: ctx.controller,
              sourceId: ctx.source.objectId,
              sourceCardId: ctx.source.cardId,
              sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
            });
          }
        }
      } else {
        // Count lore counters among Sagas
        const sagas = ctx.game.getBattlefield({ subtypes: ['Saga'], controller: 'you' }, ctx.controller);
        let totalLore = 0;
        for (const saga of sagas) {
          totalLore += (saga.counters['lore'] ?? 0);
        }
        if (totalLore > 0) {
          const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
          const ids = creatures.map(c => c.objectId);
          ctx.game.grantPumpToObjectsUntilEndOfTurn(ids, totalLore, 0);
        }
      }
    },
    { description: 'Whenever one or more Bards you control attack, choose one: put a lore counter on Sagas; or creatures get +1/+0 per lore counter among Sagas.' }
  )
  .build();
