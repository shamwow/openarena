import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ShatteringSpree = CardBuilder.create('Shattering Spree')
  .cost('{R}')
  .types(CardType.SORCERY)
  .replicate('{R}')
  .spellEffect(
    (ctx) => {
      const target = ctx.targets[0];
      if (!target || typeof target === 'string') {
        return;
      }

      ctx.game.destroyPermanent(target.objectId);
    },
    {
      targets: [{
        what: 'permanent',
        filter: { types: [CardType.ARTIFACT] },
        count: 1,
      }],
      description: 'Destroy target artifact.',
    },
  )
  .build();
