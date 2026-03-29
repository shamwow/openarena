import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FeedTheSwarm = CardBuilder.create('Feed the Swarm')
  .cost('{1}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(c =>
      c.controller !== ctx.controller &&
      (c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes(CardType.ENCHANTMENT))
    );
    if (targets.length > 0) {
      const target = await ctx.choices.chooseOne('Destroy target creature or enchantment an opponent controls', targets, c => c.definition.name);
      const mv = target.definition.cost?.mana
        ? (target.definition.cost.mana.generic + target.definition.cost.mana.W + target.definition.cost.mana.U + target.definition.cost.mana.B + target.definition.cost.mana.R + target.definition.cost.mana.G + target.definition.cost.mana.C)
        : 0;
      ctx.game.destroyPermanent(target.objectId);
      ctx.game.loseLife(ctx.controller, mv);
    }
  }, { description: "Destroy target creature or enchantment an opponent controls. You lose life equal to that permanent's mana value." })
  .build();
