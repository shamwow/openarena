import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createDoubleStrikeAbilities } from '../../../engine/AbilityPrimitives';

export const TophGreatestEarthbender = CardBuilder.create('Toph, Greatest Earthbender')
  .cost('{2}{R}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(3, 3)
  .etbEffect(async (ctx) => {
    // TODO: Properly track mana spent to cast her; using CMC as approximation
    const manaSpent = 4; // {2}{R}{G} = 4 mana
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, manaSpent, ctx.controller);
    }
  }, { description: 'When Toph enters, earthbend X, where X is the amount of mana spent to cast her.' })
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createDoubleStrikeAbilities(),
      filter: {
        types: [CardType.CREATURE, CardType.LAND],
        controller: 'you',
        custom: (card) => card.definition.types.includes(CardType.CREATURE) && card.definition.types.includes(CardType.LAND),
      },
    },
    { description: 'Land creatures you control have double strike.' },
  )
  .build();
