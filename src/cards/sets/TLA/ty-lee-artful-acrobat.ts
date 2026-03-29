import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TyLeeArtfulAcrobat = CardBuilder.create('Ty Lee, Artful Acrobat')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Performer')
  .supertypes('Legendary')
  .stats(3, 2)
  .prowess()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const pay = await ctx.choices.chooseYesNo('Pay {1} to prevent a creature from blocking?');
      if (pay) {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE as any] });
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Choose creature that can\'t block this turn', creatures, c => c.definition.name);
          // TODO: "can't block this turn" restriction not fully supported
          void target;
        }
      }
    },
    { optional: true, description: 'Whenever Ty Lee attacks, you may pay {1}. When you do, target creature can\'t block this turn.' },
  )
  .build();
