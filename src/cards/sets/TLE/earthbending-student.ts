import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createVigilanceAbilities } from '../../../engine/AbilityPrimitives';

export const EarthbendingStudent = CardBuilder.create('Earthbending Student')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(1, 3)
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
      abilities: createVigilanceAbilities(),
      filter: {
        types: [CardType.CREATURE, CardType.LAND],
        controller: 'you',
      },
    },
    { description: 'Land creatures you control have vigilance.' }
  )
  .build();
