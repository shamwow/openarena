import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CorruptCourtOfficial = CardBuilder.create('Corrupt Court Official')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Advisor')
  .stats(1, 1)
  .etbEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length === 0) return;
    const opponent = await ctx.choices.choosePlayer('Choose target opponent to discard a card', opponents);
    const hand = ctx.game.getHand(opponent);
    if (hand.length === 0) return;
    const chosen = await ctx.choices.chooseOne(
      'Choose a card to discard',
      hand,
      c => c.definition.name
    );
    ctx.game.discardCard(opponent, chosen.objectId);
  }, { description: 'When this creature enters, target opponent discards a card.' })
  .build();
