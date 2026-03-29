import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SandbendersStorm = CardBuilder.create("Sandbenders' Storm")
  .cost('{3}{W}')
  .types(CardType.INSTANT)
  .modal([
    {
      label: 'Destroy target creature with power 4 or greater.',
      effect: async (ctx) => {
        const targets = ctx.game.getBattlefield({ types: [CardType.CREATURE], power: { op: 'gte', value: 4 } });
        if (targets.length === 0) return;
        const target = await ctx.choices.chooseOne('Choose target creature with power 4 or greater', targets, c => c.definition.name);
        ctx.game.destroyPermanent(target.objectId);
      },
    },
    {
      label: 'Earthbend 3.',
      effect: async (ctx) => {
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        if (lands.length === 0) return;
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 3, ctx.controller);
      },
    },
  ], 1, 'Choose one —')
  .build();
