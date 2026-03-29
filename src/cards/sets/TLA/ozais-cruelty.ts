import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const OzaisCruelty = CardBuilder.create("Ozai's Cruelty")
  .cost('{2}{B}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    const allPlayers = [...opponents, ctx.controller];
    const target = await ctx.choices.choosePlayer('Choose target player', allPlayers);
    ctx.game.dealDamage(ctx.source.objectId, target, 2, false);
    // Discard two cards
    const hand = ctx.game.getHand(target);
    const discardCount = Math.min(2, hand.length);
    if (discardCount > 0) {
      const chosen = await ctx.choices.chooseN('Discard two cards', hand, discardCount, c => c.definition.name);
      for (const card of chosen) {
        ctx.game.discardCard(target, card.objectId);
      }
    }
  }, { description: "Ozai's Cruelty deals 2 damage to target player. That player discards two cards." })
  .build();
