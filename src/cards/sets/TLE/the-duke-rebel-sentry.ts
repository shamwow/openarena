import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createHexproofAbilities } from '../../../engine/AbilityPrimitives';

export const TheDukeRebelSentry = CardBuilder.create('The Duke, Rebel Sentry')
  .cost('{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(0, 1)
  .etbEffect(async (ctx) => {
    ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
      player: ctx.controller,
      sourceId: ctx.source.objectId,
      sourceCardId: ctx.source.cardId,
      sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
    });
  }, { description: 'The Duke enters with a +1/+1 counter on him.' })
  .activated(
    { tap: true, custom: (_game, source) => {
      // Check if source has any counter to remove
      const counters = Object.entries(source.counters || {});
      return counters.some(([_type, count]) => count > 0);
    } },
    async (ctx) => {
      // Remove a counter from The Duke
      const counterTypes = Object.entries(ctx.source.counters || {}).filter(([_, count]) => count > 0);
      if (counterTypes.length === 0) return;
      const [counterType] = counterTypes[0];
      ctx.game.removeCounters(ctx.source.objectId, counterType, 1);
      // Put +1/+1 on another target creature and grant hexproof
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId);
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose another target creature you control', creatures, c => c.definition.name);
      ctx.game.addCounters(target.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createHexproofAbilities(),
      );
    },
    { description: '{T}, Remove a counter from The Duke: Put a +1/+1 counter on another target creature you control. It gains hexproof until end of turn.' },
  )
  .build();
