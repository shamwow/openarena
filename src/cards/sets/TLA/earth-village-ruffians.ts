import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EarthVillageRuffians = CardBuilder.create('Earth Village Ruffians')
  .cost('{2}{B/G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Rogue')
  .stats(3, 1)
  .diesEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
    ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
  }, { description: 'When this creature dies, earthbend 2.' })
  .build();
