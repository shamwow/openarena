import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CatGator = CardBuilder.create('Cat-Gator')
  .cost('{6}{B}')
  .types(CardType.CREATURE)
  .subtypes('Fish', 'Crocodile')
  .stats(3, 2)
  .lifelink()
  .etbEffect(async (ctx) => {
    const swamps = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller)
      .filter(c => c.definition.subtypes.includes('Swamp'));
    const damage = swamps.length;
    if (damage > 0) {
      const allTargets = [
        ...ctx.game.getBattlefield({ types: [CardType.CREATURE] }),
      ];
      const playerTargets = [...ctx.game.getOpponents(ctx.controller), ctx.controller];
      if (allTargets.length > 0 || playerTargets.length > 0) {
        const targetType = await ctx.choices.chooseOne('Choose target type', ['Creature', 'Player'] as const, t => t);
        if (targetType === 'Creature' && allTargets.length > 0) {
          const target = await ctx.choices.chooseOne('Deal damage to target', allTargets, c => c.definition.name);
          ctx.game.dealDamage(ctx.source.objectId, target.objectId, damage, false);
        } else if (targetType === 'Player') {
          const target = await ctx.choices.choosePlayer('Deal damage to target player', playerTargets);
          ctx.game.dealDamage(ctx.source.objectId, target, damage, false);
        }
      }
    }
  }, { description: 'When this creature enters, it deals damage equal to the number of Swamps you control to any target.' })
  .build();
