import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const StandUnited = CardBuilder.create('Stand United')
  .cost('{1}{G/W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
    if (target.definition.subtypes.includes('Ally')) {
      await ctx.game.scry(ctx.controller, 2);
    }
  }, { description: 'Target creature gets +2/+2 until end of turn. If it\'s an Ally, scry 2.' })
  .build();
