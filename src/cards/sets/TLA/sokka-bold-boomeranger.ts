import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SokkaBoldBoomeranger = CardBuilder.create('Sokka, Bold Boomeranger')
  .cost('{U}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(1, 1)
  .etbEffect(async (ctx) => {
    const hand = ctx.game.getHand(ctx.controller);
    if (hand.length === 0) return;
    const toDiscard = await ctx.choices.chooseUpToN('Discard up to two cards', hand, 2, c => c.definition.name);
    for (const card of toDiscard) {
      ctx.game.discardCard(ctx.controller, card.objectId);
    }
    ctx.game.drawCards(ctx.controller, toDiscard.length);
  }, { description: 'When Sokka enters, discard up to two cards, then draw that many cards.' })
  .triggered(
    { on: 'cast-spell', filter: { types: [CardType.ARTIFACT], controller: 'you' } },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever you cast an artifact or Lesson spell, put a +1/+1 counter on Sokka.' },
  )
  .triggered(
    { on: 'cast-spell', filter: { subtypes: ['Lesson'], controller: 'you' } },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever you cast a Lesson spell, put a +1/+1 counter on Sokka.' },
  )
  .build();
