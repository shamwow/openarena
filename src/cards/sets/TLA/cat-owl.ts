import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CatOwl = CardBuilder.create('Cat-Owl')
  .cost('{3}{W/U}')
  .types(CardType.CREATURE)
  .subtypes('Cat', 'Bird')
  .stats(3, 3)
  .flying()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const targets = ctx.game.getBattlefield().filter(
        c => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.CREATURE),
      );
      if (targets.length === 0) return;
      const target = await ctx.choices.chooseOne('Untap target artifact or creature', targets, c => c.definition.name);
      ctx.game.untapPermanent(target.objectId);
    },
    { description: 'Whenever this creature attacks, untap target artifact or creature.' },
  )
  .build();
