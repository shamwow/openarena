import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const CrystallineArmor = CardBuilder.create('Crystalline Armor')
  .cost('{3}{G}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'creature', count: 1 })
  .grantToAttached({
    type: 'custom',
    apply: (game, source) => {
      if (!source.attachedTo) return;
      for (const pid of game.turnOrder) {
        for (const card of game.zones[pid].BATTLEFIELD) {
          if (card.objectId === source.attachedTo) {
            const landCount = game.zones[card.controller].BATTLEFIELD.filter(
              (c: any) => c.definition.types.includes('Land')
            ).length;
            card.modifiedPower = (card.modifiedPower ?? card.definition.power ?? 0) + landCount;
            card.modifiedToughness = (card.modifiedToughness ?? card.definition.toughness ?? 0) + landCount;
            return;
          }
        }
      }
    },
  })
  .grantToAttached({
    type: 'grant-abilities',
    abilities: createTrampleAbilities(),
    filter: { self: true },
  })
  .build();
