import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createIndestructibleAbilities } from '../../../engine/AbilityPrimitives';

export const InspiringCall = CardBuilder.create('Inspiring Call')
  .cost('{2}{G}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
      .filter(c => (c.counters['+1/+1'] ?? 0) > 0);
    ctx.game.drawCards(ctx.controller, creatures.length);
    for (const creature of creatures) {
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        creature.objectId,
        creature.zoneChangeCounter,
        createIndestructibleAbilities(),
      );
    }
  }, { description: 'Draw a card for each creature you control with a +1/+1 counter on it. Those creatures gain indestructible until end of turn.' })
  .build();
