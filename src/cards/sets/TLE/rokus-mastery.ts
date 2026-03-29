import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RokusMastery = CardBuilder.create("Roku's Mastery")
  .cost('{X}{R}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Deal X damage to target creature', creatures, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, x, false);
    }
    if (x >= 4) {
      await ctx.game.scry(ctx.controller, 2);
    }
  }, { description: "Roku's Mastery deals X damage to target creature. If X is 4 or greater, scry 2." })
  .build();
