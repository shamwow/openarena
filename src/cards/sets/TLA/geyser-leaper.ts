import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const GeyserLeaper = CardBuilder.create('Geyser Leaper')
  .cost('{4}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(4, 3)
  .flying()
  .activated(
    {
      mana: parseManaCost('{4}'),
      genericTapSubstitution: {
        amount: 4,
        filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' },
        ignoreSummoningSickness: true,
      },
    },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length > 0) {
        const toDiscard = await ctx.choices.chooseOne('Discard a card', hand, c => c.definition.name);
        ctx.game.moveCard(toDiscard.objectId, 'GRAVEYARD', ctx.controller);
      }
    },
    { description: 'Waterbend {4}: Draw a card, then discard a card.' },
  )
  .build();
