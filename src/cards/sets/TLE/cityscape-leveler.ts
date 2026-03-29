import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

const cityscapeLevelerTarget = {
  what: 'permanent' as const,
  count: 1,
  upTo: true,
  filter: {
    custom: (card: import('../../../engine/types').CardInstance) => !card.definition.types.includes(CardType.LAND),
  },
};

export const CityscapeLeveler = CardBuilder.create('Cityscape Leveler')
  .cost('{8}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .subtypes('Construct')
  .stats(8, 8)
  .trample()
  .triggered(
    { on: 'cast-spell', filter: { self: true } },
    (ctx) => {
      const target = ctx.targets[0];
      if (!target || typeof target === 'string') {
        return;
      }

      const controller = target.controller;
      ctx.game.destroyPermanent(target.objectId);
      ctx.game.createPredefinedToken(controller, 'Powerstone');
    },
    {
      targets: [cityscapeLevelerTarget],
      description: 'When you cast this spell, destroy up to one target nonland permanent. Its controller creates a tapped Powerstone token.',
    },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const target = ctx.targets[0];
      if (!target || typeof target === 'string') {
        return;
      }

      const controller = target.controller;
      ctx.game.destroyPermanent(target.objectId);
      ctx.game.createPredefinedToken(controller, 'Powerstone');
    },
    {
      targets: [cityscapeLevelerTarget],
      description: 'Whenever this creature attacks, destroy up to one target nonland permanent. Its controller creates a tapped Powerstone token.',
    },
  )
  .unearth('{8}')
  .build();
