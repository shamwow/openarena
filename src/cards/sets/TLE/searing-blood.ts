import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SearingBlood = CardBuilder.create('Searing Blood')
  .cost('{R}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, 2, false);
    // TODO: Register delayed trigger — when that creature dies this turn, deal 3 damage to its controller
    ctx.game.registerDelayedTrigger({
      trigger: { on: 'dies', filter: { custom: (card) => card.objectId === target.objectId } },
      effect: async (innerCtx) => {
        ctx.game.dealDamage(ctx.source.objectId, target.controller, 3, false);
      },
      expiresAt: 'end-of-turn',
      description: 'When that creature dies this turn, Searing Blood deals 3 damage to the creature\'s controller.',
    });
  }, { description: 'Searing Blood deals 2 damage to target creature. When that creature dies this turn, Searing Blood deals 3 damage to the creature\'s controller.' })
  .build();
