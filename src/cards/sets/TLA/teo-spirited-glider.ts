import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TeoSpiritedGlider = CardBuilder.create('Teo, Spirited Glider')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Pilot', 'Ally')
  .stats(1, 4)
  .flying()
  .triggered(
    { on: 'attacks', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      // TODO: Only trigger when one or more creatures with flying attack
      ctx.game.drawCards(ctx.controller, 1);
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length === 0) return;
      const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
      const isNonland = !toDiscard.definition.types.includes(CardType.LAND);
      ctx.game.discardCard(ctx.controller, toDiscard.objectId);
      if (isNonland) {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        if (creatures.length > 0) {
          const target = await ctx.choices.chooseOne('Put a +1/+1 counter on target creature', creatures, c => c.definition.name);
          ctx.game.addCounters(target.objectId, '+1/+1', 1, {
            player: ctx.controller,
            sourceId: ctx.source.objectId,
            sourceCardId: ctx.source.cardId,
            sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
          });
        }
      }
    },
    { description: 'Whenever one or more creatures you control with flying attack, draw a card, then discard a card. When you discard a nonland card this way, put a +1/+1 counter on target creature you control.' },
  )
  .build();
