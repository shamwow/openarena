import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createFlyingAbilities, createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const OzaiThePhoenixKing = CardBuilder.create('Ozai, the Phoenix King')
  .cost('{2}{B}{B}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(7, 7)
  .trample()
  .haste()
  .firebending(4)
  // TODO: If you would lose unspent mana, that mana becomes red instead
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        // Check if player has 6+ unspent mana
        const pool = game.manaPool?.[source.controller];
        if (!pool) return;
        const totalMana = (pool.W ?? 0) + (pool.U ?? 0) + (pool.B ?? 0) + (pool.R ?? 0) + (pool.G ?? 0) + (pool.C ?? 0);
        if (totalMana >= 6) {
          const abilities = source.modifiedAbilities ?? [...source.definition.abilities];
          abilities.push(...createFlyingAbilities(), ...createIndestructibleAbilities());
          source.modifiedAbilities = abilities;
        }
      },
    },
    { description: 'Ozai has flying and indestructible as long as you have six or more unspent mana.' },
  )
  .build();
