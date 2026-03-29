import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType, parseManaCost } from '../../../engine/types';
import { createMenaceAbilities } from '../../../engine/AbilityPrimitives';
import { eventsThisTurn } from '../../turnLog';

export const AzulaRuthlessFirebender = CardBuilder.create('Azula, Ruthless Firebender')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble')
  .stats(3, 3)
  .firebending(1)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const hand = ctx.game.getHand(ctx.controller);
      if (hand.length > 0) {
        const doDiscard = await ctx.choices.chooseYesNo('Discard a card?');
        if (doDiscard) {
          const toDiscard = await ctx.choices.chooseOne('Choose a card to discard', hand, c => c.definition.name);
          ctx.game.discardCard(ctx.controller, toDiscard.objectId);
        }
      }
      const playersWhoDiscarded = new Set(
        eventsThisTurn(ctx.state)
          .filter((event) => event.type === GameEventType.DISCARDED)
          .map((event) => event.player),
      );
      if (playersWhoDiscarded.size > 0) {
        ctx.game.addPlayerCounters(ctx.controller, 'experience', playersWhoDiscarded.size);
      }
    },
    { optional: true, description: 'Whenever Azula attacks, you may discard a card. Then you get an experience counter for each player who discarded a card this turn.' }
  )
  .activated(
    { mana: parseManaCost('{2}{B}') },
    async (ctx) => {
      const expCounters = ctx.state.players[ctx.controller].counters?.experience ?? 0;
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], expCounters, expCounters);
      ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, ctx.source.objectId, ctx.source.zoneChangeCounter, createMenaceAbilities());
    },
    { description: '{2}{B}: Until end of turn, Azula gets +1/+1 for each experience counter you have and gains menace.' }
  )
  .build();
