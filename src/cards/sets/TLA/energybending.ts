import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Energybending = CardBuilder.create('Energybending')
  .cost('{2}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect((ctx) => {
    // Lands you control gain all basic land types until end of turn
    // TODO: Granting basic land types requires modifying the land's subtypes temporarily
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Lands you control gain all basic land types until end of turn. Draw a card.' })
  .build();
