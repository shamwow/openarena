import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const EelHounds = CardBuilder.create('Eel-Hounds')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Fish', 'Dog')
  .stats(4, 2)
  .trample()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId);
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Choose another creature to get +2/+2 and trample', creatures, c => c.definition.name);
        ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
        ctx.game.grantAbilitiesUntilEndOfTurn(
          target.objectId,
          ctx.source.objectId,
          ctx.source.zoneChangeCounter,
          createTrampleAbilities(),
        );
      }
    },
    { description: 'Whenever this creature attacks, another target creature you control gets +2/+2 and gains trample until end of turn.' }
  )
  .build();
