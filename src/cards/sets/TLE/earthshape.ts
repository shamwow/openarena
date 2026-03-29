import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHexproofAbilities, createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const Earthshape = CardBuilder.create('Earthshape')
  .cost('{2}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // Earthbend 3
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands, c => c.definition.name);
    ctx.game.earthbendLand(target.objectId, 3, ctx.controller);
    // Grant hexproof and indestructible to creatures with power <= land's power
    const landPower = 3; // The land gets 3 +1/+1 counters, so power is 3
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    for (const creature of creatures) {
      const power = creature.modifiedPower ?? creature.definition.power ?? 0;
      if (power <= landPower) {
        ctx.game.grantAbilitiesUntilEndOfTurn(
          creature.objectId,
          ctx.source.objectId,
          ctx.source.zoneChangeCounter,
          [...createHexproofAbilities(), ...createIndestructibleAbilities()],
        );
      }
    }
    // TODO: You gain hexproof until end of turn
  }, { description: "Earthbend 3. Then each creature you control with power less than or equal to that land's power gains hexproof and indestructible until end of turn. You gain hexproof until end of turn." })
  .build();
