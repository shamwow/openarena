import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RaucousAudience = CardBuilder.create('Raucous Audience')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(2, 1)
  .activated(
    { tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const hasBigCreature = creatures.some(c => (c.modifiedPower ?? c.definition.power ?? 0) >= 4);
      if (hasBigCreature) {
        ctx.game.addMana(ctx.controller, 'G', 2);
      } else {
        ctx.game.addMana(ctx.controller, 'G', 1);
      }
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['G'] }],
      description: '{T}: Add {G}. If you control a creature with power 4 or greater, add {G}{G} instead.',
    },
  )
  .build();
