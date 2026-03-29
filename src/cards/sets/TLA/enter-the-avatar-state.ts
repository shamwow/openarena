import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities, createFirstStrikeAbilities, createLifelinkAbilities, createHexproofAbilities } from '../../../engine/AbilityPrimitives';

export const EnterTheAvatarState = CardBuilder.create('Enter the Avatar State')
  .cost('{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Choose target creature you control', creatures, c => c.definition.name);
      // TODO: Becomes an Avatar in addition to its other types
      ctx.game.grantAbilitiesUntilEndOfTurn(
        target.objectId,
        ctx.source.objectId,
        ctx.source.zoneChangeCounter,
        [...createFlyingAbilities(), ...createFirstStrikeAbilities(), ...createLifelinkAbilities(), ...createHexproofAbilities()],
      );
    }
  }, { description: 'Until end of turn, target creature you control becomes an Avatar in addition to its other types and gains flying, first strike, lifelink, and hexproof.' })
  .build();
