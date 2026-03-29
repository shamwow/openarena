import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const EarthRumbleWrestlers = CardBuilder.create('Earth Rumble Wrestlers')
  .cost('{3}{R/G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Performer')
  .stats(3, 4)
  .reach()
  // TODO: Track "a land entered the battlefield under your control this turn" condition
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        // Check if you control a land creature or a land entered this turn
        const controlsLandCreature = game.zones[source.controller].BATTLEFIELD.some(
          c => c.definition.types.includes(CardType.LAND) && c.definition.types.includes(CardType.CREATURE),
        );
        // TODO: Also check if a land entered this turn
        if (controlsLandCreature) {
          source.modifiedPower = (source.modifiedPower ?? source.definition.power ?? 0) + 1;
          const abilities = source.modifiedAbilities ?? [...source.definition.abilities];
          abilities.push(...createTrampleAbilities());
          source.modifiedAbilities = abilities;
        }
      },
    },
    { description: 'This creature gets +1/+0 and has trample as long as you control a land creature or a land entered the battlefield under your control this turn.' },
  )
  .build();
