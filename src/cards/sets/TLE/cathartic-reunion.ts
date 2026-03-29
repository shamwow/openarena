import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CatharticReunion = CardBuilder.create('Cathartic Reunion')
  .cost('{1}{R}')
  .types(CardType.SORCERY)
  .additionalCost('discard-two', { discard: 2 }, 'Discard two cards')
  .spellEffect(async (ctx) => {
    ctx.game.drawCards(ctx.controller, 3);
  }, { description: 'As an additional cost, discard two cards. Draw three cards.' })
  .build();
