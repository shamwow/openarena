import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Meteorite = CardBuilder.create('Meteorite')
  .cost('{5}')
  .types(CardType.ARTIFACT)
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const opponents = ctx.game.getOpponents(ctx.controller);
    const allTargets = [
      ...creatures.map(c => ({ id: c.objectId, label: c.definition.name })),
      ...opponents.map(p => ({ id: p, label: `Player ${p}` })),
      { id: ctx.controller, label: `You (${ctx.controller})` },
    ];
    if (allTargets.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 2 damage to any target', allTargets, t => t.label);
      ctx.game.dealDamage(ctx.source.objectId, target.id, 2, false);
    }
  }, { description: 'When this artifact enters, it deals 2 damage to any target.' })
  .tapForAnyColor()
  .build();
