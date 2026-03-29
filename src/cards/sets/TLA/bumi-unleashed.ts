import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BumiUnleashed = CardBuilder.create('Bumi, Unleashed')
  .cost('{3}{R}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(5, 4)
  .trample()
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 4', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 4, ctx.controller);
    }
  }, { description: 'When Bumi enters, earthbend 4.' })
  .triggered(
    { on: 'deals-damage', filter: { self: true }, damageType: 'combat' },
    async (ctx) => {
      // Untap all lands
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      for (const land of lands) {
        ctx.game.untapPermanent(land.objectId);
      }
      // TODO: Additional combat phase where only land creatures can attack
      ctx.game.grantExtraCombat();
    },
    { description: 'Whenever Bumi deals combat damage to a player, untap all lands you control. After this phase, there is an additional combat phase. Only land creatures can attack during that combat phase.' }
  )
  .build();
