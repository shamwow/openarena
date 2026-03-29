import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const FoundingOfOmashu = CardBuilder.create('Founding of Omashu')
  .cost('{2}{R}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: (ctx) => {
        for (let i = 0; i < 2; i++) {
          ctx.game.createToken(ctx.controller, {
            name: 'Ally',
            types: [CardType.CREATURE],
            subtypes: ['Ally'],
            power: 1,
            toughness: 1,
            colorIdentity: [ManaColor.WHITE],
          });
        }
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        // You may discard a card. If you do, draw a card.
        const hand = ctx.game.getHand(ctx.controller);
        if (hand.length > 0) {
          const chosen = await ctx.choices.chooseUpToN('Discard a card to draw a card?', hand, 1, c => c.definition.name);
          if (chosen.length > 0) {
            ctx.game.moveCard(chosen[0].objectId, 'GRAVEYARD', ctx.controller);
            ctx.game.drawCards(ctx.controller, 1);
          }
        }
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
        ctx.game.grantPumpToObjectsUntilEndOfTurn(creatures.map(c => c.objectId), 1, 0);
      },
    },
  ])
  .build();
