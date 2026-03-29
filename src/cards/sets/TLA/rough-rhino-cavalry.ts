import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const RoughRhinoCavalry = CardBuilder.create('Rough Rhino Cavalry')
  .cost('{4}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Mercenary')
  .stats(5, 5)
  .firebending(2)
  .activated(
    { mana: parseManaCost('{8}') },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 2);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        ctx.source.objectId,
        ctx.source.zoneChangeCounter,
        createTrampleAbilities(),
      );
    },
    {
      timing: 'sorcery',
      isExhaust: true,
      description: 'Exhaust — {8}: Put two +1/+1 counters on this creature. It gains trample until end of turn.',
    }
  )
  .build();
