import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const BitterWork = CardBuilder.create('Bitter Work')
  .cost('{1}{R}{G}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'attacks', filter: { types: [CardType.CREATURE], controller: 'you', power: { op: 'gte', value: 4 } } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { oncePerTurn: true, description: 'Whenever you attack a player with one or more creatures with power 4 or greater, draw a card.' }
  )
  .activated(
    { mana: parseManaCost('{4}') },
    async (ctx) => {
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend 4', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, 4, ctx.controller);
      }
    },
    {
      timing: 'sorcery',
      activateOnlyDuringYourTurn: true,
      isExhaust: true,
      description: 'Exhaust — {4}: Earthbend 4. Activate only during your turn.',
    }
  )
  .build();
