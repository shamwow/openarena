import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ExplosiveShot = CardBuilder.create('Explosive Shot')
  .cost('{1}{R}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 4 damage to target creature', creatures, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, 4, false);
    }
  }, { description: 'Explosive Shot deals 4 damage to target creature.' })
  .build();
