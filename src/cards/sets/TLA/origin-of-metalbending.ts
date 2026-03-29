import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const OriginOfMetalbending = CardBuilder.create('Origin of Metalbending')
  .cost('{1}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .modal([
    {
      label: 'Destroy target artifact or enchantment.',
      effect: async (ctx) => {
        const targets = ctx.game.getBattlefield().filter(
          c => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.ENCHANTMENT),
        );
        if (targets.length > 0) {
          const target = await ctx.choices.chooseOne('Destroy target artifact or enchantment', targets, c => c.definition.name);
          ctx.game.destroyPermanent(target.objectId);
        }
      },
    },
    {
      label: 'Put a +1/+1 counter on target creature you control. It gains indestructible until end of turn.',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Choose target creature you control', creatures, c => c.definition.name);
          ctx.game.addCounters(target.objectId, '+1/+1', 1);
          ctx.game.grantAbilitiesUntilEndOfTurn(
            ctx.source.objectId,
            target.objectId,
            target.zoneChangeCounter,
            createIndestructibleAbilities(),
          );
        }
      },
    },
  ], 1, 'Choose one')
  .build();
