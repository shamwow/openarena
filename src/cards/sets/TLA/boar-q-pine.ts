import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BoarQPine = CardBuilder.create('Boar-q-pine')
  .cost('{2}{R}')
  .types(CardType.CREATURE)
  .subtypes('Boar', 'Porcupine')
  .stats(2, 2)
  .triggered(
    { on: 'cast-spell', filter: { types: [CardType.INSTANT, CardType.SORCERY, CardType.ENCHANTMENT, CardType.ARTIFACT], controller: 'you' } },
    async (ctx) => {
      // Noncreature spell check
      const event = ctx.event as any;
      if (event?.cardTypes?.includes(CardType.CREATURE)) return;
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever you cast a noncreature spell, put a +1/+1 counter on this creature.' }
  )
  .build();
