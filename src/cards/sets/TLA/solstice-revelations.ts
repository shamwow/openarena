import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SolsticeRevelations = CardBuilder.create('Solstice Revelations')
  .cost('{2}{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Exile cards from the top until a nonland card is found
    const library = ctx.game.getLibrary(ctx.controller);
    let nonlandCard = null;
    for (const card of library) {
      ctx.game.moveCard(card.objectId, 'EXILE');
      if (!card.definition.types.includes(CardType.LAND)) {
        nonlandCard = card;
        break;
      }
    }
    if (!nonlandCard) return;
    // Count Mountains
    const mountains = ctx.game.getBattlefield({ subtypes: ['Mountain'], controller: 'you' }, ctx.controller);
    // TODO: Calculate mana value of exiled card
    const castForFree = await ctx.choices.chooseYesNo(`Cast ${nonlandCard.definition.name} without paying its mana cost?`);
    if (castForFree) {
      await ctx.game.castWithoutPayingManaCost(nonlandCard.objectId, ctx.controller);
    } else {
      ctx.game.moveCard(nonlandCard.objectId, 'HAND', ctx.controller);
    }
  }, { description: 'Exile cards from the top of your library until you exile a nonland card. You may cast that card without paying its mana cost if the spell\'s mana value is less than the number of Mountains you control. If you don\'t cast that card this way, put it into your hand.' })
  .flashback('{6}{R}')
  .build();
