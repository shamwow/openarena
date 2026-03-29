import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const TundraTank = CardBuilder.create('Tundra Tank')
  .cost('{2}{B}')
  .types(CardType.ARTIFACT)
  .subtypes('Vehicle')
  .stats(4, 4)
  .firebending(1)
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE as any], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Grant indestructible to a creature until end of turn', creatures, c => c.definition.name);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createIndestructibleAbilities(),
      );
    }
  }, { description: 'When this Vehicle enters, target creature you control gains indestructible until end of turn.' })
  .crew(1)
  .build();
