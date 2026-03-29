import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BoomerangBasics = CardBuilder.create('Boomerang Basics')
  .cost('{U}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield().filter(c => !c.definition.types.includes(CardType.LAND));
    if (permanents.length === 0) return;
    const target = await ctx.choices.chooseOne('Return target nonland permanent to its owner\'s hand', permanents, c => c.definition.name);
    const wasControlled = target.controller === ctx.controller;
    ctx.game.returnToHand(target.objectId);
    if (wasControlled) {
      ctx.game.drawCards(ctx.controller, 1);
    }
  }, { description: 'Return target nonland permanent to its owner\'s hand. If you controlled that permanent, draw a card.' })
  .build();
