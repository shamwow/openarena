import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WaterbenderAscension = CardBuilder.create('Waterbender Ascension')
  .cost('{1}{U}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'deals-damage', filter: { types: [CardType.CREATURE], controller: 'you' }, damageType: 'combat' },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'quest', 1);
      const questCounters = ctx.source.counters['quest'] ?? 0;
      if (questCounters >= 4) {
        ctx.game.drawCards(ctx.controller, 1);
      }
    },
    { description: 'Whenever a creature you control deals combat damage to a player, put a quest counter on this enchantment. Then if it has four or more quest counters on it, draw a card.' },
  )
  .activated(
    { mana: parseManaCost('{4}') },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Target creature can\'t be blocked this turn', creatures, c => c.definition.name);
        // TODO: Grant unblockable until end of turn
        void target;
      }
    },
    {
      description: 'Waterbend {4}: Target creature can\'t be blocked this turn.',
    },
  )
  .waterbend(4)
  .build();
