import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EarthKingdomJailer = CardBuilder.create('Earth Kingdom Jailer')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(3, 3)
  .etbEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(c => {
      if (c.controller === ctx.controller) return false;
      const mv = c.definition.cost?.mana
        ? (c.definition.cost.mana.generic + c.definition.cost.mana.W + c.definition.cost.mana.U + c.definition.cost.mana.B + c.definition.cost.mana.R + c.definition.cost.mana.G + c.definition.cost.mana.C)
        : 0;
      if (mv < 3) return false;
      return c.definition.types.includes(CardType.ARTIFACT) ||
             c.definition.types.includes(CardType.CREATURE) ||
             c.definition.types.includes(CardType.ENCHANTMENT);
    });
    if (targets.length > 0) {
      const chosen = await ctx.choices.chooseUpToN(
        'Exile up to one target artifact, creature, or enchantment an opponent controls with mana value 3 or greater',
        targets, 1, c => c.definition.name
      );
      for (const t of chosen) {
        // TODO: Exile until this creature leaves the battlefield
        ctx.game.moveCard(t.objectId, 'EXILE', t.owner);
      }
    }
  }, { description: 'When this creature enters, exile up to one target artifact, creature, or enchantment an opponent controls with mana value 3 or greater until this creature leaves the battlefield.' })
  .build();
