import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ImprisonedInTheMoon = CardBuilder.create('Imprisoned in the Moon')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Aura')
  .enchant({ what: 'permanent', count: 1 })
  // TODO: Enchanted permanent is a colorless land with "{T}: Add {C}" and loses all other card types and abilities
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        if (!source.attachedTo) return;
        for (const pid of game.turnOrder) {
          for (const card of game.zones[pid].BATTLEFIELD) {
            if (card.objectId === source.attachedTo) {
              // TODO: Properly turn enchanted permanent into a colorless land
              card.modifiedAbilities = [];
              break;
            }
          }
        }
      },
    },
    { description: 'Enchanted permanent is a colorless land with "{T}: Add {C}" and loses all other card types and abilities.' },
  )
  .build();
