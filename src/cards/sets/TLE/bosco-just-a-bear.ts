import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const BoscoJustABear = CardBuilder.create('Bosco, Just a Bear')
  .cost('{4}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bear')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    const legendaryCreatures = ctx.game.getBattlefield({
      types: [CardType.CREATURE],
      supertypes: ['Legendary'],
      controller: 'you',
    }, ctx.controller);
    const count = legendaryCreatures.length;
    for (let i = 0; i < count; i++) {
      ctx.game.createPredefinedToken(ctx.controller, 'Food');
    }
  }, { description: 'When Bosco enters, create a Food token for each legendary creature you control.' })
  .activated(
    { mana: parseManaCost('{2}{G}'), sacrifice: { subtypes: ['Food'], controller: 'you' } },
    async (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 2, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
      ctx.game.grantAbilitiesUntilEndOfTurn(ctx.source.objectId, ctx.source.objectId, ctx.source.zoneChangeCounter, createTrampleAbilities());
    },
    { description: '{2}{G}, Sacrifice a Food: Put two +1/+1 counters on Bosco. He gains trample until end of turn.' }
  )
  .build();
