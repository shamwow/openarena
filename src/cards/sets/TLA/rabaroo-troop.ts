import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities } from '../../../engine/AbilityPrimitives';

export const RabarooTroop = CardBuilder.create('Rabaroo Troop')
  .cost('{3}{W}{W}')
  .types(CardType.CREATURE)
  .subtypes('Rabbit', 'Kangaroo')
  .stats(3, 5)
  .landfall((ctx) => {
    ctx.game.grantAbilitiesUntilEndOfTurn(
      ctx.source.objectId,
      ctx.source.objectId,
      ctx.source.zoneChangeCounter,
      createFlyingAbilities(),
    );
    ctx.game.gainLife(ctx.controller, 1);
  }, { description: 'Landfall — Whenever a land you control enters, this creature gains flying until end of turn and you gain 1 life.' })
  .landcycling('{2}', 'Plains')
  .build();
