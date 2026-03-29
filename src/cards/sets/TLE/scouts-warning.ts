import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ScoutsWarning = CardBuilder.create("Scout's Warning")
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // TODO: The next creature card you play this turn can be played as though it had flash.
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'The next creature card you play this turn can be played as though it had flash. Draw a card.' })
  .build();
