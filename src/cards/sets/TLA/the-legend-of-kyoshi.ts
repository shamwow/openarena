import { CardBuilder } from '../../CardBuilder';
import { Layer, CardType } from '../../../engine/types';
import { createHexproofAbilities, createTrampleAbilities } from '../../../engine/AbilityPrimitives';

const AvatarKyoshi = CardBuilder.create('Avatar Kyoshi')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar')
  .stats(5, 4)
  .staticAbility(
    {
      type: 'grant-abilities',
      abilities: [...createTrampleAbilities(), ...createHexproofAbilities()],
      filter: { types: [CardType.LAND], controller: 'you' },
    },
    { description: 'Lands you control have trample and hexproof.' },
  )
  .activated(
    { tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      const maxPower = Math.max(0, ...creatures.map(card => card.modifiedPower ?? card.definition.power ?? 0));
      if (maxPower <= 0) return;
      const color = await ctx.choices.chooseOne(
        'Choose a color of mana to add',
        ['W', 'U', 'B', 'R', 'G'] as const,
        mana => ({ W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green' }[mana]),
      );
      ctx.game.addMana(ctx.controller, color, maxPower);
    },
    { description: '{T}: Add X mana of any one color, where X is the greatest power among creatures you control.' },
  )
  .build();

export const TheLegendOfKyoshi = CardBuilder.create('The Legend of Kyoshi')
  .cost('{4}{G}{G}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        const maxPower = Math.max(0, ...creatures.map(card => card.modifiedPower ?? card.definition.power ?? 0));
        if (maxPower > 0) {
          ctx.game.drawCards(ctx.controller, maxPower);
        }
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        const handCount = ctx.game.getHand(ctx.controller).length;
        const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
        if (lands.length === 0) return;
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, card => card.definition.name);
        ctx.game.earthbendLand(target.objectId, handCount, ctx.controller);
        const zoneChangeCounter = target.zoneChangeCounter;
        ctx.state.continuousEffects.push({
          id: `legend-of-kyoshi-island:${target.objectId}:${zoneChangeCounter}`,
          sourceId: ctx.source.objectId,
          layer: Layer.TYPE,
          timestamp: ctx.state.timestampCounter++,
          duration: {
            type: 'while-condition',
            check: (game) => Boolean(game.turnOrder.flatMap(pid => game.zones[pid].BATTLEFIELD).find(
              card => card.objectId === target.objectId && card.zoneChangeCounter === zoneChangeCounter,
            )),
          },
          appliesTo: (permanent) => permanent.objectId === target.objectId && permanent.zoneChangeCounter === zoneChangeCounter,
          apply: (permanent) => {
            const subtypes = permanent.modifiedSubtypes ?? [...permanent.definition.subtypes];
            if (!subtypes.includes('Island')) {
              subtypes.push('Island');
            }
            permanent.modifiedSubtypes = subtypes;
          },
        });
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        ctx.game.moveCard(ctx.source.objectId, 'EXILE', ctx.controller);
        ctx.game.moveCard(ctx.source.objectId, 'BATTLEFIELD', ctx.controller, { transformed: true });
      },
    },
  ])
  .transform(AvatarKyoshi)
  .build();
