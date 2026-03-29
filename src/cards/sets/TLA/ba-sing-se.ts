import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const BaSingSe = CardBuilder.create('Ba Sing Se')
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({ supertypes: ['Basic'] })
  .tapForMana('G')
  .activated(
    { mana: parseManaCost('{2}{G}'), tap: true },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
      }
    },
    { timing: 'sorcery', description: '{2}{G}, {T}: Earthbend 2. Activate only as a sorcery.' }
  )
  .build();
