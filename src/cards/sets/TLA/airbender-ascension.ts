import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AirbenderAscension = CardBuilder.create('Airbender Ascension')
  .cost('{1}{W}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    // Airbend up to one target creature
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Airbend up to one target creature', creatures, 1, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
      }
    }
  }, { description: 'When this enchantment enters, airbend up to one target creature.' })
  .triggered(
    { on: 'enter-battlefield', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'quest', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever a creature you control enters, put a quest counter on this enchantment.' }
  )
  .triggered(
    { on: 'end-step', whose: 'yours' },
    async (ctx) => {
      const questCounters = ctx.source.counters['quest'] ?? 0;
      if (questCounters < 4) return;
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length > 0) {
        const chosen = await ctx.choices.chooseUpToN('Exile up to one target creature you control', creatures, 1, c => c.definition.name);
        for (const target of chosen) {
          ctx.game.exilePermanent(target.objectId);
          // TODO: Return to the battlefield under owner's control immediately
        }
      }
    },
    { description: 'At the beginning of your end step, if this has 4+ quest counters, exile up to one target creature you control, then return it to the battlefield.' }
  )
  .build();
