import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FreedomFighterRecruit = CardBuilder.create('Freedom Fighter Recruit')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(0, 2)
  // TODO: Power is equal to the number of creatures you control (star power)
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const creatures = game.zones[source.controller]?.BATTLEFIELD.filter(
          c => c.definition.types.includes('Creature' as CardType),
        ) ?? [];
        source.modifiedPower = creatures.length;
      },
    },
    { description: "Freedom Fighter Recruit's power is equal to the number of creatures you control." },
  )
  .build();
