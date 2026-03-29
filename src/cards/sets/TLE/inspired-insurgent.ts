import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const InspiredInsurgent = CardBuilder.create('Inspired Insurgent')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(2, 2)
  .activated(
    { mana: parseManaCost('{1}'), sacrifice: { self: true } },
    async (ctx) => {
      const targets = ctx.game.getBattlefield()
        .filter(c => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.ENCHANTMENT));
      if (targets.length === 0) return;
      const target = await ctx.choices.chooseOne('Destroy target artifact or enchantment', targets, c => c.definition.name);
      ctx.game.destroyPermanent(target.objectId);
    },
    { description: '{1}, Sacrifice this creature: Destroy target artifact or enchantment.' },
  )
  .build();
