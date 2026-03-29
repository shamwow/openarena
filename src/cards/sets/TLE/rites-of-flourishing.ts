import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RitesOfFlourishing = CardBuilder.create('Rites of Flourishing')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  // TODO: Each player may play an additional land on each of their turns
  .triggered(
    { on: 'step', step: 'DRAW' },
    async (ctx) => {
      const activePlayer = ctx.state.activePlayer;
      ctx.game.drawCards(activePlayer, 1);
    },
    { description: 'At the beginning of each player\'s draw step, that player draws an additional card.' }
  )
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Grant additional land drop to each player
      },
    },
    { description: 'Each player may play an additional land on each of their turns.' }
  )
  .build();
