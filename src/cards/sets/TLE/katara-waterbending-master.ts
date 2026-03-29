import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const KataraWaterbendingMaster = CardBuilder.create('Katara, Waterbending Master')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(1, 3)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) =>
        event.type === GameEventType.SPELL_CAST
        && event.castBy === source.controller
        && game.activePlayer !== source.controller,
    },
    (ctx) => {
      ctx.game.addPlayerCounters(ctx.controller, 'experience', 1);
    },
    { description: 'Whenever you cast a spell during an opponent\'s turn, you get an experience counter.' },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const expCounters = ctx.state.players[ctx.controller].counters?.experience ?? 0;
      if (expCounters > 0) {
        const draw = await ctx.choices.chooseYesNo(`Draw ${expCounters} card(s) and discard a card?`);
        if (draw) {
          ctx.game.drawCards(ctx.controller, expCounters);
          const hand = ctx.game.getHand(ctx.controller);
          if (hand.length > 0) {
            const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
            ctx.game.discardCard(ctx.controller, toDiscard.objectId);
          }
        }
      }
    },
    { optional: true, description: 'Whenever Katara attacks, you may draw a card for each experience counter you have. If you do, discard a card.' },
  )
  .build();
