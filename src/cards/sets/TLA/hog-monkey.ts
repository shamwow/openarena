import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createMenaceAbilities } from '../../../engine/AbilityPrimitives';

export const HogMonkey = CardBuilder.create('Hog-Monkey')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Boar', 'Monkey')
  .stats(3, 2)
  .triggered(
    { on: 'step', step: 'COMBAT_BEGIN', whose: 'yours' },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => (c.counters['+1/+1'] ?? 0) > 0);
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose a creature with a +1/+1 counter', creatures, c => c.definition.name);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createMenaceAbilities(),
      );
    },
    { description: 'At the beginning of combat on your turn, target creature you control with a +1/+1 counter on it gains menace until end of turn.' },
  )
  .activated(
    { mana: parseManaCost('{5}') },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 2);
    },
    {
      isExhaust: true,
      description: 'Exhaust \u2014 {5}: Put two +1/+1 counters on this creature.',
    },
  )
  .build();
