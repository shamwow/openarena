import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WhirlwindTechnique = CardBuilder.create('Whirlwind Technique')
  .cost('{4}{U}{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Target player draws two cards, then discards a card
    const players = ctx.game.getActivePlayers();
    const targetPlayer = await ctx.choices.choosePlayer('Choose a player to draw 2 and discard 1', players);
    ctx.game.drawCards(targetPlayer, 2);
    const hand = ctx.game.getHand(targetPlayer);
    if (hand.length > 0) {
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      ctx.game.discardCard(targetPlayer, toDiscard.objectId);
    }
    // Airbend up to two target creatures
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const targets = await ctx.choices.chooseUpToN('Airbend up to two target creatures', creatures, 2, c => c.definition.name);
      for (const target of targets) {
        ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
      }
    }
  }, { description: 'Target player draws two cards, then discards a card. Airbend up to two target creatures.' })
  .build();
