import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const SundialOfTheInfinite = CardBuilder.create('Sundial of the Infinite')
  .cost('{2}')
  .types(CardType.ARTIFACT)
  .activated(
    { mana: parseManaCost('{1}'), tap: true },
    async (ctx) => {
      ctx.game.endTurn();
    },
    {
      activateOnlyDuringYourTurn: true,
      description: '{1}, {T}: End the turn. Activate only during your turn.',
    },
  )
  .build();
