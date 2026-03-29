import { CardBuilder } from '../../CardBuilder';
import { createFirebendingTriggeredAbility } from '../../firebending';
import { CardType, GameEventType, Step } from '../../../engine/types';

export const IrohDragonOfTheWest = CardBuilder.create('Iroh, Dragon of the West')
  .cost('{2}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(4, 4)
  .haste()
  .mentor()
  .triggered(
    {
      on: 'custom',
      match: (event, source) =>
        event.type === GameEventType.STEP_CHANGE &&
        event.step === Step.BEGINNING_OF_COMBAT &&
        event.activePlayer === source.controller,
    },
    (ctx) => {
      const eligibleCreatures = ctx.game
        .getBattlefield({ types: [CardType.CREATURE] }, ctx.controller)
        .filter((card) => Object.values(card.counters).some((count) => count > 0));

      for (const creature of eligibleCreatures) {
        ctx.game.grantAbilitiesUntilEndOfTurn(
          ctx.source.objectId,
          creature.objectId,
          creature.zoneChangeCounter,
          [createFirebendingTriggeredAbility(2)],
        );
      }
    },
    {
      description: 'At the beginning of combat on your turn, each creature you control with a counter on it gains firebending 2 until end of turn.',
    },
  )
  .build();
