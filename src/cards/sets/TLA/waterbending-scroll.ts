import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const WaterbendingScroll = CardBuilder.create('Waterbending Scroll')
  .cost('{1}{U}')
  .types(CardType.ARTIFACT)
  .activated(
    { mana: parseManaCost('{6}'), tap: true },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    {
      description: '{6}, {T}: Draw a card. This ability costs {1} less to activate for each Island you control.',
      // TODO: Cost reduction based on Islands you control
    },
  )
  .build();
