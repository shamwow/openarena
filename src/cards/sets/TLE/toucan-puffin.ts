import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ToucanPuffin = CardBuilder.create('Toucan-Puffin')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Bird')
  .stats(2, 2)
  .flying()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Target creature you control gets +2/+0', creatures, c => c.definition.name);
      ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 0);
    }
  }, { description: 'When this creature enters, target creature you control gets +2/+0 until end of turn.' })
  .build();
