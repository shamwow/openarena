import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DesertersDisciple = CardBuilder.create("Deserter's Disciple")
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(2, 2)
  .activated(
    { tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId && (c.modifiedPower ?? c.definition.power ?? 0) <= 2);
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Choose another creature with power 2 or less', creatures, c => c.definition.name);
        // TODO: Grant "can't be blocked this turn" to target
        ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 0, 0);
      }
    },
    { description: "{T}: Another target creature you control with power 2 or less can't be blocked this turn." }
  )
  .build();
