import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const TurtleDuck = CardBuilder.create('Turtle-Duck')
  .cost('{G}')
  .types(CardType.CREATURE)
  .subtypes('Turtle', 'Bird')
  .stats(0, 4)
  .activated(
    { mana: parseManaCost('{3}') },
    (ctx) => {
      // TODO: Set base power to 4 (not pump) and grant trample until end of turn
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 4, 0);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        ctx.source.objectId,
        ctx.source.zoneChangeCounter,
        createTrampleAbilities(),
      );
    },
    { description: '{3}: Until end of turn, this creature has base power 4 and gains trample.' },
  )
  .build();
