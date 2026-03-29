import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const DiligentZookeeper = CardBuilder.create('Diligent Zookeeper')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen', 'Ally')
  .stats(4, 4)
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        for (const pid of game.turnOrder) {
          for (const card of game.zones[pid].BATTLEFIELD) {
            if (card.controller === source.controller &&
                card.objectId !== source.objectId &&
                card.definition.types.includes(CardType.CREATURE as any) &&
                !getEffectiveSubtypes(card).includes('Human')) {
              const typeCount = Math.min(getEffectiveSubtypes(card).length, 10);
              card.modifiedPower = (card.modifiedPower ?? card.definition.power ?? 0) + typeCount;
              card.modifiedToughness = (card.modifiedToughness ?? card.definition.toughness ?? 0) + typeCount;
            }
          }
        }
      },
    },
    { description: 'Each non-Human creature you control gets +1/+1 for each of its creature types, to a maximum of 10.' }
  )
  .build();
