import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BoltBend = CardBuilder.create('Bolt Bend')
  .cost('{3}{R}')
  .types(CardType.INSTANT)
  // Cost reduction if you control a creature with power 4+
  .staticAbility(
    {
      type: 'cost-modification',
      costDelta: { generic: -3, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 },
      filter: { self: true },
    },
    {
      condition: (game, source) => {
        const bf = game.zones[source.controller]?.BATTLEFIELD ?? [];
        return bf.some(c => c.definition.types.includes(CardType.CREATURE as any) && (c.modifiedPower ?? c.definition.power ?? 0) >= 4);
      },
      description: 'This spell costs {3} less to cast if you control a creature with power 4 or greater.',
    }
  )
  .spellEffect(async (ctx) => {
    // TODO: Change the target of target spell or ability with a single target
    // This requires stack manipulation which is complex to implement
  }, { description: 'Change the target of target spell or ability with a single target.' })
  .build();
