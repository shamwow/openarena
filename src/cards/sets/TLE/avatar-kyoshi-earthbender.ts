import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AvatarKyoshiEarthbender = CardBuilder.create('Avatar Kyoshi, Earthbender')
  .cost('{5}{G}{G}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar')
  .stats(6, 6)
  // Hexproof during your turn
  .staticAbility(
    {
      type: 'cant-be-targeted',
      by: 'opponents',
      filter: { self: true },
    },
    {
      condition: (game, source) => game.activePlayer === source.controller,
      description: 'During your turn, Avatar Kyoshi has hexproof.',
    }
  )
  .triggered(
    { on: 'step', step: 'BEGINNING_OF_COMBAT' },
    async (ctx) => {
      if (ctx.state.activePlayer !== ctx.controller) return;
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 8', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 8, ctx.controller);
        ctx.game.untapPermanent(target.objectId);
      }
    },
    { description: 'At the beginning of combat on your turn, earthbend 8, then untap that land.' }
  )
  .build();
