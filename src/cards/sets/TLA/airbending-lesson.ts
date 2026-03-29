import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AirbendingLesson = CardBuilder.create('Airbending Lesson')
  .cost('{2}{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield().filter(c => !c.definition.types.includes(CardType.LAND));
    if (permanents.length > 0) {
      const target = await ctx.choices.chooseOne('Airbend target nonland permanent', permanents, c => c.definition.name);
      ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
    }
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Airbend target nonland permanent. Draw a card.' })
  .build();
