import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ValorousStance = CardBuilder.create('Valorous Stance')
  .cost('{1}{W}')
  .types(CardType.INSTANT)
  .modal([
    {
      label: 'Target creature gains indestructible until end of turn.',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Choose a creature to gain indestructible', creatures, c => c.definition.name);
          const { createIndestructibleAbilities } = await import('../../../engine/AbilityPrimitives');
          ctx.game.grantAbilitiesUntilEndOfTurn(
            ctx.source.objectId,
            target.objectId,
            target.zoneChangeCounter,
            createIndestructibleAbilities(),
          );
        }
      },
    },
    {
      label: 'Destroy target creature with toughness 4 or greater.',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c =>
          (c.modifiedToughness ?? c.definition.toughness ?? 0) >= 4,
        );
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Destroy target creature with toughness 4 or greater', creatures, c => c.definition.name);
          ctx.game.destroyPermanent(target.objectId);
        }
      },
    },
  ], 1, 'Choose one —')
  .build();
