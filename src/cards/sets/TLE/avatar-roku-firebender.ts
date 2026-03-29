import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AvatarRokuFirebender = CardBuilder.create('Avatar Roku, Firebender')
  .cost('{3}{R}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar')
  .stats(6, 6)
  .triggered(
    { on: 'attacks' },
    async (ctx) => {
      // Whenever a player attacks, add six {R}
      ctx.game.addMana(ctx.controller, 'R', 6);
      // TODO: Mana doesn't empty until end of combat
    },
    { description: 'Whenever a player attacks, add six {R}. Until end of combat, you don\'t lose this mana as steps end.' }
  )
  .activated(
    { mana: parseManaCost('{R}{R}{R}') },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Target creature gets +3/+0', creatures, c => c.definition.name);
        ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 3, 0);
      }
    },
    { description: '{R}{R}{R}: Target creature gets +3/+0 until end of turn.' }
  )
  .build();
