import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TigerDillo = CardBuilder.create('Tiger-Dillo')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .subtypes('Cat', 'Armadillo')
  .stats(4, 3)
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const battlefield = game.zones[source.controller].BATTLEFIELD;
        const hasOtherBigCreature = battlefield.some(c =>
          c.objectId !== source.objectId &&
          c.definition.types.includes('Creature' as CardType) &&
          (c.modifiedPower ?? c.definition.power ?? 0) >= 4,
        );
        if (!hasOtherBigCreature) {
          // TODO: Properly prevent attack/block via cant-attack/cant-block
        }
      },
    },
    { description: 'This creature can\'t attack or block unless you control another creature with power 4 or greater.' },
  )
  .build();
