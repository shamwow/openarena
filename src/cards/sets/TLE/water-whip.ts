import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WaterWhip = CardBuilder.create('Water Whip')
  .cost('{U}{U}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .waterbend(5)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const targets = await ctx.choices.chooseUpToN('Return up to two target creatures to their owners\' hands', creatures, 2, c => c.definition.name);
      for (const target of targets) {
        ctx.game.returnToHand(target.objectId);
      }
    }
    ctx.game.drawCards(ctx.controller, 2);
  }, { description: 'Return up to two target creatures to their owners\' hands. Draw two cards.' })
  .build();
