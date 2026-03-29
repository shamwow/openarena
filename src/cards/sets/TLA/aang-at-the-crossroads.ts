import { CardBuilder } from '../../CardBuilder';
import { CardType, manaCostTotal } from '../../../engine/types';
import { createVigilanceAbilities } from '../../../engine/AbilityPrimitives';

const AangDestinedSavior = CardBuilder.create('Aang, Destined Savior')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar', 'Ally')
  .stats(4, 4)
  .flying()
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: createVigilanceAbilities(),
      filter: {
        types: [CardType.CREATURE, CardType.LAND],
        controller: 'you',
      },
    },
    { description: 'Land creatures you control have vigilance.' },
  )
  .triggered(
    { on: 'step', step: 'BEGINNING_OF_COMBAT' },
    async (ctx) => {
      if (ctx.state.activePlayer !== ctx.controller) return;
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    },
    { description: 'At the beginning of combat on your turn, earthbend 2.' },
  )
  .build();

export const AangAtTheCrossroads = CardBuilder.create('Aang, at the Crossroads')
  .cost('{2}{G}{W}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(3, 3)
  .flying()
  .etbEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const topCards = library.slice(-5);
    if (topCards.length === 0) return;
    const eligible = topCards.filter(card =>
      card.definition.types.includes(CardType.CREATURE) &&
      manaCostTotal(card.definition.cost?.mana ?? { generic: 0, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }) <= 4,
    );
    if (eligible.length > 0) {
      const chosen = await ctx.choices.chooseUpToN(
        'Choose a creature card with mana value 4 or less to put onto the battlefield',
        eligible,
        1,
        card => card.definition.name,
      );
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      }
    }
    const remaining = topCards.filter(card => card.zone !== 'BATTLEFIELD');
    for (const card of remaining) {
      ctx.game.moveCard(card.objectId, 'LIBRARY', ctx.controller);
    }
  }, { description: 'When Aang enters, look at the top five cards of your library. You may put a creature card with mana value 4 or less from among them onto the battlefield. Put the rest on the bottom of your library in a random order.' })
  .triggered(
    {
      on: 'leave-battlefield',
      filter: { types: [CardType.CREATURE], controller: 'you' },
    },
    (ctx) => {
      if (!ctx.event || ctx.event.type !== 'LEAVES_BATTLEFIELD') return;
      if (ctx.event.objectId === ctx.source.objectId) return;
      const sourceId = ctx.source.objectId;
      const zoneChangeCounter = ctx.source.zoneChangeCounter;
      ctx.game.registerDelayedTrigger({
        id: `aang-at-the-crossroads:${sourceId}:${zoneChangeCounter}:${ctx.state.timestampCounter}`,
        source: ctx.source,
        controller: ctx.controller,
        expiresAfterTrigger: true,
        ability: {
          kind: 'triggered',
          trigger: { on: 'upkeep', whose: 'each' },
          optional: false,
          description: 'Transform Aang at the beginning of the next upkeep.',
          effect: (innerCtx) => {
            const current = innerCtx.game.getCard(sourceId);
            if (!current || current.zone !== 'BATTLEFIELD') return;
            if (current.zoneChangeCounter !== zoneChangeCounter) return;
            if (current.isTransformed) return;
            innerCtx.game.transformPermanent(sourceId);
          },
        },
      });
    },
    { description: 'When another creature you control leaves the battlefield, transform Aang at the beginning of the next upkeep.' },
  )
  .transform(AangDestinedSavior)
  .build();
