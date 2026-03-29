import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const TreetopVillage = CardBuilder.create('Treetop Village')
  .types(CardType.LAND)
  .entersTapped()
  .tapForMana('G')
  .activated(
    { mana: parseManaCost('{1}{G}') },
    async (ctx) => {
      // TODO: Properly animate land as 3/3 green Ape with trample until end of turn
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 3, 3);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        ctx.source.objectId,
        ctx.source.zoneChangeCounter,
        createTrampleAbilities(),
      );
    },
    {
      timing: 'sorcery',
      description: '{1}{G}: This land becomes a 3/3 green Ape creature with trample until end of turn. It\'s still a land.',
    },
  )
  .build();
