import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const MeditationPools = CardBuilder.create('Meditation Pools')
  .types(CardType.LAND)
  .entersTapped()
  .tapForMana('G')
  .tapForMana('U')
  .activated(
    { mana: parseManaCost('{4}'), tap: true, sacrifice: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: '{4}, {T}, Sacrifice this land: Draw a card.' },
  )
  .build();
