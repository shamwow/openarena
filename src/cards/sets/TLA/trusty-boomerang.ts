import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const TrustyBoomerang = CardBuilder.create('Trusty Boomerang')
  .cost('{1}')
  .types(CardType.ARTIFACT)
  .subtypes('Equipment')
  .grantToAttached({
    type: 'grant-abilities',
    abilities: [{
      kind: 'activated' as const,
      cost: { mana: parseManaCost('{1}'), tap: true },
      effect: async (ctx) => {
        const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.controller !== ctx.controller);
        if (oppCreatures.length > 0) {
          const target = await ctx.choices.chooseOne('Tap target creature', oppCreatures, c => c.definition.name);
          ctx.game.tapPermanent(target.objectId);
        }
        // Return Trusty Boomerang to its owner's hand
        // TODO: Find the equipment attached to this creature and return it
      },
      timing: 'instant' as const,
      isManaAbility: false,
      description: '{1}, {T}: Tap target creature. Return Trusty Boomerang to its owner\'s hand.',
    }],
    filter: { self: true },
  })
  .equip('{1}')
  .build();
