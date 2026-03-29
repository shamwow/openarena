import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const MokuMeanderingDrummer = CardBuilder.create('Moku, Meandering Drummer')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Bard', 'Ally')
  .stats(2, 2)
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you', custom: (card) => !card.spellTypes?.includes(CardType.CREATURE) } },
    async (ctx) => {
      const pay = await ctx.choices.chooseYesNo('Pay {1} to give Moku +2/+1 and your creatures haste?');
      if (pay) {
        const paid = ctx.game.payMana(ctx.controller, parseManaCost('{1}'));
        if (paid) {
          ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 2, 1);
          const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
          for (const creature of creatures) {
            ctx.game.grantAbilitiesUntilEndOfTurn(
              ctx.source.objectId,
              creature.objectId,
              creature.zoneChangeCounter,
              createHasteAbilities(),
            );
          }
        }
      }
    },
    { optional: true, description: 'Whenever you cast a noncreature spell, you may pay {1}. If you do, Moku gets +2/+1 and creatures you control gain haste until end of turn.' },
  )
  .build();
