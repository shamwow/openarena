import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AzulaOnTheHunt = CardBuilder.create('Azula, On the Hunt')
  .cost('{3}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(4, 3)
  .firebending(2)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      ctx.game.loseLife(ctx.controller, 1);
      ctx.game.createPredefinedToken(ctx.controller, 'Clue');
    },
    { description: 'Whenever Azula attacks, you lose 1 life and create a Clue token.' }
  )
  .build();
