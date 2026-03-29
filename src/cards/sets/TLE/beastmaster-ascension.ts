import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BeastmasterAscension = CardBuilder.create('Beastmaster Ascension')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'attacks', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'quest', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { optional: true, description: 'Whenever a creature you control attacks, you may put a quest counter on this enchantment.' }
  )
  .staticAbility(
    {
      type: 'pump',
      power: 5,
      toughness: 5,
      filter: { controller: 'you', types: [CardType.CREATURE] },
    },
    {
      condition: (_game, source) => (source.counters['quest'] ?? 0) >= 7,
      description: 'As long as this enchantment has seven or more quest counters on it, creatures you control get +5/+5.',
    }
  )
  .build();
