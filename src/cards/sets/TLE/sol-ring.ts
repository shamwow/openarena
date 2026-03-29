import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SolRing = CardBuilder.create('Sol Ring')
  .cost('{1}')
  .types(CardType.ARTIFACT)
  .activated(
    { tap: true },
    async (ctx) => {
      ctx.game.addMana(ctx.controller, 'C', 2);
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 2, colors: ['C'] }],
      description: '{T}: Add {C}{C}.',
    },
  )
  .build();
