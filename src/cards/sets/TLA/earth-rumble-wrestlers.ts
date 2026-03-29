import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';
import { someEventThisTurn } from '../../turnLog';

export const EarthRumbleWrestlers = CardBuilder.create('Earth Rumble Wrestlers')
  .cost('{3}{R/G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Performer')
  .stats(3, 4)
  .reach()
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const controlsLandCreature = game.zones[source.controller].BATTLEFIELD.some(
          c => c.definition.types.includes(CardType.LAND) && c.definition.types.includes(CardType.CREATURE),
        );
        const landEnteredThisTurn = someEventThisTurn(
          game,
          (event) => event.type === GameEventType.ZONE_CHANGE
            && event.toZone === 'BATTLEFIELD'
            && event.controller === source.controller
            && Boolean(event.lastKnownInfo?.definition.types.includes(CardType.LAND)),
        );
        if (controlsLandCreature || landEnteredThisTurn) {
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
