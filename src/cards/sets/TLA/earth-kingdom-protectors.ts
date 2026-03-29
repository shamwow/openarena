import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const EarthKingdomProtectors = CardBuilder.create('Earth Kingdom Protectors')
  .cost('{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(1, 1)
  .vigilance()
  .activated(
    { sacrifice: { self: true } },
    async (ctx) => {
      const allies = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId && getEffectiveSubtypes(c).includes('Ally'));
      if (allies.length > 0) {
        const target = await ctx.choices.chooseOne('Choose an Ally to gain indestructible', allies, c => c.definition.name);
        ctx.game.grantAbilitiesUntilEndOfTurn(
          target.objectId,
          ctx.source.objectId,
          ctx.source.zoneChangeCounter,
          createIndestructibleAbilities(),
        );
      }
    },
    { description: 'Sacrifice this creature: Another target Ally you control gains indestructible until end of turn.' }
  )
  .build();
