import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RazorRings = CardBuilder.create('Razor Rings')
  .cost('{1}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    // TODO: Filter for attacking or blocking creatures only
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target attacking or blocking creature', creatures, c => c.definition.name);
    const toughness = target.modifiedToughness ?? target.definition.toughness ?? 0;
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, 4, false);
    const excess = Math.max(0, 4 - toughness);
    if (excess > 0) {
      ctx.game.gainLife(ctx.controller, excess);
    }
  }, { description: 'Razor Rings deals 4 damage to target attacking or blocking creature. You gain life equal to the excess damage dealt this way.' })
  .build();
