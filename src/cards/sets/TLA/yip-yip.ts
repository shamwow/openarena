import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const YipYip = CardBuilder.create('Yip Yip!')
  .cost('{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Target creature you control gets +2/+2', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
    // If that creature is an Ally, it also gains flying
    if (target.definition.subtypes?.includes('Ally')) {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createFlyingAbilities(),
      );
    }
  }, { description: 'Target creature you control gets +2/+2 until end of turn. If that creature is an Ally, it also gains flying until end of turn.' })
  .build();
