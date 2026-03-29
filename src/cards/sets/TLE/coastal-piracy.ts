import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CoastalPiracy = CardBuilder.create('Coastal Piracy')
  .cost('{2}{U}{U}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'deals-combat-damage-to-player', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { optional: true, description: 'Whenever a creature you control deals combat damage to an opponent, you may draw a card.' }
  )
  .build();
