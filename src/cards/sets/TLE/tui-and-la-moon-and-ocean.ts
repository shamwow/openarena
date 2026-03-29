import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TuiAndLaMoonAndOcean = CardBuilder.create('Tui and La, Moon and Ocean')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Fish', 'Spirit')
  .stats(3, 3)
  .triggered(
    { on: 'tap', filter: { self: true } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever Tui and La become tapped, draw a card.' },
  )
  .triggered(
    { on: 'untap', filter: { self: true } },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
    },
    { description: 'Whenever Tui and La become untapped, put a +1/+1 counter on them.' },
  )
  .build();
