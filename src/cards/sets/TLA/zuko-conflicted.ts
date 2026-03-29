import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ZukoConflicted = CardBuilder.create('Zuko, Conflicted')
  .cost('{B}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Rogue')
  .stats(2, 3)
  .triggered(
    { on: 'step', step: 'precombat-main' },
    async (ctx) => {
      if (ctx.state.activePlayer !== ctx.controller) return;
      // TODO: Track which modes have been chosen previously
      // Simplified: present all four modes, player chooses one; loses 2 life
      const modes = [
        { label: 'Draw a card', value: 'draw' },
        { label: 'Put a +1/+1 counter on Zuko', value: 'counter' },
        { label: 'Add {R}', value: 'mana' },
        { label: 'Exile Zuko, return under opponent\'s control', value: 'exile' },
      ];
      const chosen = await ctx.choices.chooseOne('Choose one that hasn\'t been chosen', modes, m => m.label);
      ctx.game.loseLife(ctx.controller, 2);
      switch (chosen.value) {
        case 'draw':
          ctx.game.drawCards(ctx.controller, 1);
          break;
        case 'counter':
          ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
          break;
        case 'mana':
          ctx.game.addMana(ctx.controller, 'R', 1);
          break;
        case 'exile': {
          ctx.game.exilePermanent(ctx.source.objectId);
          const opponents = ctx.game.getOpponents(ctx.controller);
          if (opponents.length > 0) {
            // TODO: Return under opponent's control
          }
          break;
        }
      }
    },
    { description: 'At the beginning of your first main phase, choose one that hasn\'t been chosen and you lose 2 life.' },
  )
  .build();
