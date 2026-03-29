import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHexproofAbilities, createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const HeroicIntervention = CardBuilder.create('Heroic Intervention')
  .cost('{1}{G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller);
    for (const perm of permanents) {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        perm.objectId,
        perm.zoneChangeCounter,
        [...createHexproofAbilities(), ...createIndestructibleAbilities()],
      );
    }
  }, { description: 'Permanents you control gain hexproof and indestructible until end of turn.' })
  .build();
