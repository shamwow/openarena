import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const EarthbenderAscension = CardBuilder.create('Earthbender Ascension')
  .cost('{2}{G}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    // Earthbend 2
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
    // Search for a basic land, put it onto the battlefield tapped
    await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      filter: { types: [CardType.LAND], supertypes: ['Basic'] },
      destination: 'BATTLEFIELD',
      count: 1,
      optional: true,
      shuffle: true,
    });
  }, { description: 'When this enchantment enters, earthbend 2. Then search your library for a basic land card, put it onto the battlefield tapped, then shuffle.' })
  .landfall(async (ctx) => {
    ctx.game.addCounters(ctx.source.objectId, 'quest', 1, {
      player: ctx.controller,
      sourceId: ctx.source.objectId,
      sourceCardId: ctx.source.cardId,
      sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
    });
    const questCounters = ctx.source.counters['quest'] ?? 0;
    if (questCounters >= 4) {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a creature to get a +1/+1 counter and trample', creatures, c => c.definition.name);
        ctx.game.addCounters(target.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
        ctx.game.grantAbilitiesUntilEndOfTurn(
          target.objectId,
          ctx.source.objectId,
          ctx.source.zoneChangeCounter,
          createTrampleAbilities(),
        );
      }
    }
  }, { description: 'Landfall — Whenever a land you control enters, put a quest counter on this enchantment. When you do, if it has four or more quest counters on it, put a +1/+1 counter on target creature you control. It gains trample until end of turn.' })
  .build();
