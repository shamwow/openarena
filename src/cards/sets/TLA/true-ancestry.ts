import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TrueAncestry = CardBuilder.create('True Ancestry')
  .cost('{1}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const permanentCards = graveyard.filter(c =>
      c.definition.types.includes(CardType.CREATURE) ||
      c.definition.types.includes(CardType.ARTIFACT) ||
      c.definition.types.includes(CardType.ENCHANTMENT) ||
      c.definition.types.includes(CardType.LAND),
    );
    if (permanentCards.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Return up to one permanent card from your graveyard to your hand', permanentCards, 1, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.returnToHand(card.objectId);
      }
    }
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'Return up to one target permanent card from your graveyard to your hand. Create a Clue token.' })
  .build();
