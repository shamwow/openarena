import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const FlawlessManeuver = CardBuilder.create('Flawless Maneuver')
  .cost('{2}{W}')
  .types(CardType.INSTANT)
  // TODO: If you control a commander, you may cast this spell without paying its mana cost
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    for (const creature of creatures) {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        creature.objectId,
        creature.zoneChangeCounter,
        createIndestructibleAbilities(),
      );
    }
  }, { description: 'Creatures you control gain indestructible until end of turn.' })
  .build();
