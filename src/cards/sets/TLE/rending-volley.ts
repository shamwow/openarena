import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const RendingVolley = CardBuilder.create('Rending Volley')
  .cost('{R}')
  .types(CardType.INSTANT)
  // TODO: "This spell can't be countered" — requires uncounterable flag
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c =>
      c.definition.colorIdentity.includes(ManaColor.WHITE) ||
      c.definition.colorIdentity.includes(ManaColor.BLUE)
    );
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Deal 4 damage to target white or blue creature', creatures, c => c.definition.name);
      ctx.game.dealDamage(ctx.source.objectId, target.objectId, 4, false);
    }
  }, { description: "This spell can't be countered. Rending Volley deals 4 damage to target white or blue creature." })
  .build();
