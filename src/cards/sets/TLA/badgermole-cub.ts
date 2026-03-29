import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BadgerMoleCub = CardBuilder.create('Badgermole Cub')
  .cost('{1}{G}')
  .types(CardType.CREATURE)
  .subtypes('Badger', 'Mole')
  .stats(2, 2)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 1', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 1, ctx.controller);
    }
  }, { description: 'When this creature enters, earthbend 1.' })
  .triggered(
    { on: 'tap-for-mana', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      ctx.game.addMana(ctx.controller, 'G', 1);
    },
    { isManaAbility: true, description: 'Whenever you tap a creature for mana, add an additional {G}.' }
  )
  .build();
