import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const Badgermole = CardBuilder.create('Badgermole')
  .cost('{4}{G}')
  .types(CardType.CREATURE)
  .subtypes('Badger', 'Mole')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
  }, { description: 'When this creature enters, earthbend 2.' })
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createTrampleAbilities(),
      filter: {
        controller: 'you',
        types: [CardType.CREATURE],
        custom: (card) => {
          const counters = card.counters['+1/+1'] ?? 0;
          return counters > 0;
        },
      },
    },
    { description: 'Creatures you control with +1/+1 counters on them have trample.' }
  )
  .build();
