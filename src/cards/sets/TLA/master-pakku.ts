import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const MasterPakku = CardBuilder.create('Master Pakku')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Advisor', 'Ally')
  .supertypes('Legendary')
  .stats(1, 3)
  .prowess()
  .triggered(
    { on: 'tap', filter: { self: true } },
    async (ctx) => {
      const lessonsInGraveyard = ctx.game.getGraveyard(ctx.controller)
        .filter(c => c.definition.subtypes.includes('Lesson')).length;
      if (lessonsInGraveyard > 0) {
        const opponents = ctx.game.getOpponents(ctx.controller);
        const target = await ctx.choices.chooseOne('Choose target player to mill', [ctx.controller, ...opponents], (p) => ctx.state.players[p].name);
        ctx.game.mill(target, lessonsInGraveyard);
      }
    },
    { description: 'Whenever Master Pakku becomes tapped, target player mills X cards, where X is the number of Lesson cards in your graveyard.' },
  )
  .build();
