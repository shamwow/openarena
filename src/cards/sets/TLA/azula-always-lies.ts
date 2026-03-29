import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AzulaAlwaysLies = CardBuilder.create('Azula Always Lies')
  .cost('{1}{B}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .modal([
    {
      label: 'Target creature gets -1/-1 until end of turn',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Target creature gets -1/-1', creatures, c => c.definition.name);
          ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], -1, -1);
        }
      },
    },
    {
      label: 'Put a +1/+1 counter on target creature',
      effect: async (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Put a +1/+1 counter on target creature', creatures, c => c.definition.name);
          ctx.game.addCounters(target.objectId, '+1/+1', 1, {
            player: ctx.controller,
            sourceId: ctx.source.objectId,
            sourceCardId: ctx.source.cardId,
            sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
          });
        }
      },
    },
  ], 2, 'Choose one or both', { allowRepeatedModes: false })
  .build();
