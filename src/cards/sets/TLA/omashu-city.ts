import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const OmashuCity = CardBuilder.create('Omashu City')
  .types(CardType.LAND)
  .entersTapped()
  .tapForMana('R')
  .tapForMana('G')
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
