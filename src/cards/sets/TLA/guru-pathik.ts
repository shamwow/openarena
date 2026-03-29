import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const GuruPathik = CardBuilder.create('Guru Pathik')
  .cost('{2}{G/U}{G/U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Monk', 'Ally')
  .stats(2, 4)
  .etbEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const topCards = library.slice(0, 5);
    if (topCards.length === 0) return;
    const eligible = topCards.filter(c =>
      c.definition.subtypes.includes('Lesson') ||
      c.definition.subtypes.includes('Saga') ||
      c.definition.subtypes.includes('Shrine'),
    );
    if (eligible.length > 0) {
      const chosen = await ctx.choices.chooseUpToN(
        'You may reveal a Lesson, Saga, or Shrine card and put it into your hand',
        eligible,
        1,
        c => c.definition.name,
      );
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
      }
    }
    // Put the rest on the bottom in a random order
    const remaining = topCards.filter(c => c.zone !== 'HAND');
    for (const card of remaining) {
      ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
    }
  }, { description: 'When Guru Pathik enters, look at the top five cards of your library. You may reveal a Lesson, Saga, or Shrine card from among them and put it into your hand. Put the rest on the bottom of your library in a random order.' })
  .triggered(
    {
      on: 'cast-spell',
      filter: {
        controller: 'you',
        custom: (card) => {
          const subtypes = card.spellSubtypes ?? card.definition?.subtypes ?? [];
          return subtypes.includes('Lesson') || subtypes.includes('Saga') || subtypes.includes('Shrine');
        },
      },
    },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId);
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne(
        'Put a +1/+1 counter on another target creature you control',
        creatures,
        c => c.definition.name,
      );
      ctx.game.addCounters(target.objectId, '+1/+1', 1, {
        player: ctx.controller,
        sourceId: ctx.source.objectId,
        sourceCardId: ctx.source.cardId,
        sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
      });
    },
    { description: 'Whenever you cast a Lesson, Saga, or Shrine spell, put a +1/+1 counter on another target creature you control.' },
  )
  .build();
