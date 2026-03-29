import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AbandonedAirTemple = CardBuilder.create('Abandoned Air Temple')
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({ supertypes: ['Basic'] })
  .tapForMana('W')
  .activated(
    { mana: parseManaCost('{3}{W}'), tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      for (const creature of creatures) {
        ctx.game.addCounters(creature.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    { timing: 'sorcery', description: '{3}{W}, {T}: Put a +1/+1 counter on each creature you control.' }
  )
  .build();
