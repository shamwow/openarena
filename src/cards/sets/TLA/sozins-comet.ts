import { CardBuilder } from '../../CardBuilder';
import { createFirebendingTriggeredAbility } from '../../firebending';
import { CardType } from '../../../engine/types';

export const SozinsComet = CardBuilder.create("Sozin's Comet")
  .cost('{3}{R}{R}')
  .types(CardType.SORCERY)
  .foretell('{2}{R}')
  .spellEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    for (const creature of creatures) {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        creature.objectId,
        creature.zoneChangeCounter,
        [createFirebendingTriggeredAbility(5)],
      );
    }
  }, {
    description: 'Each creature you control gains firebending 5 until end of turn.',
  })
  .build();
