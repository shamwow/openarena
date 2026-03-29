import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const MistyPalmsOasis = CardBuilder.create('Misty Palms Oasis')
  .types(CardType.LAND)
  .entersTapped()
  .tapForMana('W')
  .tapForMana('B')
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
