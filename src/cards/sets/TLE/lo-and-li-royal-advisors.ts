import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType, parseManaCost } from '../../../engine/types';

export const LoAndLiRoyalAdvisors = CardBuilder.create('Lo and Li, Royal Advisors')
  .cost('{2}{B}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Advisor')
  .stats(3, 3)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type === GameEventType.DISCARDED) {
          return (event as any).player !== source.controller;
        }
        if (event.type === GameEventType.MILLED) {
          return (event as any).player !== source.controller;
        }
        return false;
      },
    },
    (ctx) => {
      const advisors = ctx.game.getBattlefield({ subtypes: ['Advisor'], controller: 'you' }, ctx.controller);
      for (const advisor of advisors) {
        ctx.game.addCounters(advisor.objectId, '+1/+1', 1);
      }
    },
    { description: 'Whenever an opponent discards a card or mills one or more cards, put a +1/+1 counter on each Advisor you control.' },
  )
  .activated(
    { mana: parseManaCost('{2}') },
    async (ctx) => {
      const players = [...ctx.game.getOpponents(ctx.controller), ctx.controller];
      const target = await ctx.choices.choosePlayer('Choose target player to mill four', players);
      ctx.game.mill(target, 4);
    },
    { description: '{2}{U/B}: Target player mills four cards.' },
  )
  .build();
