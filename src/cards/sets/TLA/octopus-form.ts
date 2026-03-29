import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHexproofAbilities } from '../../../engine/AbilityPrimitives';

export const OctopusForm = CardBuilder.create('Octopus Form')
  .cost('{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature you control', creatures, c => c.definition.name);
    ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 1, 1);
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      target.objectId,
      target.zoneChangeCounter,
      createHexproofAbilities(),
    );
    ctx.game.untapPermanent(target.objectId);
  }, { description: 'Target creature you control gets +1/+1 and gains hexproof until end of turn. Untap it.' })
  .build();
