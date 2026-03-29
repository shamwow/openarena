import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TheArtOfTea = CardBuilder.create('The Art of Tea')
  .cost('{1}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Put a +1/+1 counter on up to one target creature you control', creatures, 1, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.addCounters(target.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    }
    ctx.game.createPredefinedToken(ctx.controller, 'Food');
  }, { description: 'Put a +1/+1 counter on up to one target creature you control. Create a Food token.' })
  .build();
