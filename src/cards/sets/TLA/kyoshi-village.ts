import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const KyoshiVillage = CardBuilder.create('Kyoshi Village')
  .types(CardType.LAND)
  .entersTapped()
  .tapForMana('G')
  .tapForMana('W')
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
