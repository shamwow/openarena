import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { createLifelinkAbilities, createMenaceAbilities } from '../../../engine/AbilityPrimitives';
import { countEventsThisTurn } from '../../turnLog';

export const FoggySwampHunters = CardBuilder.create('Foggy Swamp Hunters')
  .cost('{3}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Ranger', 'Ally')
  .stats(3, 4)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: [...createLifelinkAbilities(), ...createMenaceAbilities()],
      filter: { self: true },
    },
    {
      condition: (game, source) => {
        const drawCount = countEventsThisTurn(
          game,
          (event) => event.type === GameEventType.DREW_CARD && event.player === source.controller,
        );
        return drawCount >= 2;
      },
      description: "As long as you've drawn two or more cards this turn, this creature has lifelink and menace.",
    },
  )
  .build();
