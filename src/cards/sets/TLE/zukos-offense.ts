import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ZukosOffense = CardBuilder.create("Zuko's Offense")
  .cost('{R}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const opponents = ctx.game.getOpponents(ctx.controller);
    const allTargets = [
      ...creatures.map(c => ({ label: c.definition.name, value: c.objectId as string })),
      ...opponents.map(p => ({ label: `Player ${p}`, value: p })),
    ];
    if (allTargets.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 2 damage to any target', allTargets, t => t.label);
      ctx.game.dealDamage(ctx.source.objectId, target.value, 2, false);
    }
  }, { description: "Zuko's Offense deals 2 damage to any target." })
  .build();
