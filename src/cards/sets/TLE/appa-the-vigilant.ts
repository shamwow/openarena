import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities, createVigilanceAbilities } from '../../../engine/AbilityPrimitives';

export const AppaTheVigilant = CardBuilder.create('Appa, the Vigilant')
  .cost('{5}{W}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bison', 'Ally')
  .stats(6, 6)
  .flying()
  .vigilance()
  .triggered(
    { on: 'enter-battlefield', filter: { subtypes: ['Ally'], controller: 'you' } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const ids = creatures.map(c => c.objectId);
      ctx.game.grantPumpToObjectsUntilEndOfTurn(ids, 1, 1);
      for (const creature of creatures) {
        ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, creature.objectId, creature.zoneChangeCounter, [
          ...createFlyingAbilities(),
          ...createVigilanceAbilities(),
        ]);
      }
    },
    { description: 'Whenever Appa or another Ally you control enters, creatures you control get +1/+1 and gain flying and vigilance until end of turn.' }
  )
  .build();
