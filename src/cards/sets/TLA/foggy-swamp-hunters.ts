import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { createLifelinkAbilities, createMenaceAbilities } from '../../../engine/AbilityPrimitives';

export const FoggySwampHunters = CardBuilder.create('Foggy Swamp Hunters')
  .cost('{3}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Ranger', 'Ally')
  .stats(3, 4)
  // TODO: Properly check if two or more cards have been drawn this turn
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: [...createLifelinkAbilities(), ...createMenaceAbilities()],
      filter: { self: true },
    },
    {
      condition: (game, source) => {
        const drawCount = game.eventLog?.filter(
          e => e.type === GameEventType.DREW_CARD && e.player === source.controller && e.turn === game.turn,
        ).length ?? 0;
        return drawCount >= 2;
      },
      description: "As long as you've drawn two or more cards this turn, this creature has lifelink and menace.",
    },
  )
  .build();
