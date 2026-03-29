import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard } from '../../../engine/GameState';

export const MomoFriendlyFlier = CardBuilder.create('Momo, Friendly Flier')
  .cost('{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Lemur', 'Bat', 'Ally')
  .stats(1, 1)
  .flying()
  // TODO: The first non-Lemur creature spell with flying you cast during each of your turns costs {1} less to cast
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        if (event.objectId === source.objectId) return false;
        const enteringCard = findCard(game, event.objectId, event.objectZoneChangeCounter);
        if (!enteringCard) return false;
        if (!enteringCard.definition.types.includes('Creature')) return false;
        // Check if it has flying
        const hasFlyingAbility = enteringCard.definition.abilities.some(
          a => a.description?.toLowerCase().includes('flying'),
        );
        return hasFlyingAbility;
      },
    },
    (ctx) => {
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 1, 1);
    },
    { description: 'Whenever another creature you control with flying enters, Momo gets +1/+1 until end of turn.' },
  )
  .build();
