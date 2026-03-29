import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AgentOfTreachery = CardBuilder.create('Agent of Treachery')
  .cost('{5}{U}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rogue')
  .stats(2, 3)
  .etbEffect(async (ctx) => {
    const permanents = ctx.game.getBattlefield();
    if (permanents.length === 0) return;
    const target = await ctx.choices.chooseOne('Gain control of target permanent', permanents, c => c.definition.name);
    ctx.game.changeControl(target.objectId, ctx.controller);
  }, { description: 'When this creature enters, gain control of target permanent.' })
  .triggered(
    { on: 'end-step', whose: 'yours' },
    async (ctx) => {
      const controlled = ctx.game.getBattlefield(undefined, ctx.controller);
      const notOwned = controlled.filter(c => c.owner !== ctx.controller);
      if (notOwned.length >= 3) {
        ctx.game.drawCards(ctx.controller, 3);
      }
    },
    { description: 'At the beginning of your end step, if you control three or more permanents you don\'t own, draw three cards.' }
  )
  .build();
