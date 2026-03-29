import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FlopsieBumisBuddy = CardBuilder.create("Flopsie, Bumi's Buddy")
  .cost('{4}{G}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Ape', 'Goat')
  .stats(4, 4)
  .etbEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    for (const creature of creatures) {
      ctx.game.addCounters(creature.objectId, '+1/+1', 1);
    }
  }, { description: 'When Flopsie enters, put a +1/+1 counter on each creature you control.' })
  // TODO: Each creature you control with power 4 or greater can't be blocked by more than one creature
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Restrict blocking for creatures with power 4+
      },
    },
    { description: "Each creature you control with power 4 or greater can't be blocked by more than one creature." },
  )
  .build();
