import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const AcrobaticLeap = CardBuilder.create('Acrobatic Leap')
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 1, 3);
    ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, target.objectId, target.zoneChangeCounter, createFlyingAbilities());
    ctx.game.untapPermanent(target.objectId);
  }, { description: 'Target creature gets +1/+3 and gains flying until end of turn. Untap it.' })
  .build();
