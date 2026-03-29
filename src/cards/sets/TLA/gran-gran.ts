import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const GranGran = CardBuilder.create('Gran-Gran')
  .cost('{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Peasant', 'Ally')
  .stats(1, 2)
  .triggered(
    { on: 'becomes-tapped', filter: { self: true } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length > 0) {
        const toDiscard = await ctx.choices.chooseOne('Discard a card', hand, c => c.definition.name);
        ctx.game.moveCard(toDiscard.objectId, 'GRAVEYARD', ctx.controller);
      }
    },
    { description: 'Whenever Gran-Gran becomes tapped, draw a card, then discard a card.' },
  )
  // TODO: Noncreature spells cost {1} less if three or more Lesson cards in graveyard
  .staticAbility(
    {
      type: 'cost-reduction',
      amount: 1,
      filter: { custom: (card) => !card.definition.types.includes(CardType.CREATURE) },
    },
    {
      condition: (game, source) => {
        const graveyard = game.zones[source.controller]?.GRAVEYARD ?? [];
        return graveyard.filter(c => c.definition.subtypes.includes('Lesson')).length >= 3;
      },
      description: 'Noncreature spells you cast cost {1} less to cast as long as there are three or more Lesson cards in your graveyard.',
    },
  )
  .build();
