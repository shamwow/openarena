import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const LightningBolt = CardBuilder.create('Lightning Bolt')
  .cost('{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const opponents = ctx.game.getOpponents(ctx.controller);
    const allTargets = [
      ...creatures.map(c => ({ id: c.objectId, label: c.definition.name, isCreature: true })),
      ...opponents.map(p => ({ id: p, label: `Player ${p}`, isCreature: false })),
      { id: ctx.controller, label: `You (${ctx.controller})`, isCreature: false },
    ];
    if (allTargets.length === 0) return;
    const target = await ctx.choices.chooseOne('Deal 3 damage to any target', allTargets, t => t.label);
    ctx.game.dealDamage(ctx.source.objectId, target.id, 3, false);
  }, { description: 'Lightning Bolt deals 3 damage to any target.' })
  .build();
