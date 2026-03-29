import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TheBoulderReadyToRumble = CardBuilder.create('The Boulder, Ready to Rumble')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Performer')
  .stats(4, 4)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const bigCreatures = creatures.filter(c => (c.modifiedPower ?? c.definition.power ?? 0) >= 4);
      const x = bigCreatures.length;
      if (x === 0) return;
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, x, ctx.controller);
      }
    },
    { description: 'Whenever The Boulder attacks, earthbend X, where X is the number of creatures you control with power 4 or greater.' },
  )
  .build();
