import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FirebendingLesson = CardBuilder.create('Firebending Lesson')
  .cost('{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .kicker('{4}')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    const kicked = ctx.additionalCostsPaid?.includes('kicker');
    const damage = kicked ? 5 : 2;
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, damage, false);
  }, { description: 'Firebending Lesson deals 2 damage to target creature. If this spell was kicked, it deals 5 damage to that creature instead.' })
  .build();
