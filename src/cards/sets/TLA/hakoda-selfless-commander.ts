import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const HakodaSelflessCommander = CardBuilder.create('Hakoda, Selfless Commander')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 5)
  .vigilance()
  // TODO: You may look at the top card of your library any time
  // TODO: You may cast Ally spells from the top of your library
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Allow looking at top of library and casting Ally spells from it
      },
    },
    { description: 'You may look at the top card of your library any time. You may cast Ally spells from the top of your library.' },
  )
  .activated(
    { sacrifice: { self: true } },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      for (const creature of creatures) {
        ctx.game.grantPumpToObjectsUntilEndOfTurn([creature.objectId], 0, 5);
        ctx.game.grantAbilitiesUntilEndOfTurn(
          ctx.source.objectId,
          creature.objectId,
          creature.zoneChangeCounter,
          createIndestructibleAbilities(),
        );
      }
    },
    { description: 'Sacrifice Hakoda: Creatures you control get +0/+5 and gain indestructible until end of turn.' },
  )
  .build();
