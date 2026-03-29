import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ScarringMemories = CardBuilder.create('Scarring Memories')
  .cost('{3}{B}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  // TODO: May cast as though it had flash if you control an attacking legendary creature
  .spellEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length === 0) return;
    const opponent = await ctx.choices.choosePlayer('Choose target opponent', opponents);
    // Opponent sacrifices a creature of their choice
    const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'opponent' }, ctx.controller)
      .filter(c => c.controller === opponent);
    if (oppCreatures.length > 0) {
      const toSac = await ctx.choices.chooseOne('Choose a creature to sacrifice', oppCreatures, c => c.definition.name);
      ctx.game.sacrificePermanent(toSac.objectId, opponent);
    }
    // Discard a card
    const hand = ctx.game.getHand(opponent);
    if (hand.length > 0) {
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      ctx.game.discardCard(opponent, toDiscard.objectId);
    }
    // Lose 3 life
    ctx.game.loseLife(opponent, 3);
  }, { description: 'Target opponent sacrifices a creature of their choice, discards a card, and loses 3 life.' })
  .build();
