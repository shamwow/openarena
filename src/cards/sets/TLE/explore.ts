import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const Explore = CardBuilder.create('Explore')
  .cost('{1}{G}')
  .types(CardType.SORCERY)
  .spellEffect((ctx) => {
    // TODO: "You may play an additional land this turn" requires turn state modification
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'You may play an additional land this turn. Draw a card.' })
  .build();
