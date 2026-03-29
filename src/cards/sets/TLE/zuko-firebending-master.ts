import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const ZukoFirebendingMaster = CardBuilder.create('Zuko, Firebending Master')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(2, 2)
  .firstStrike()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    (ctx) => {
      const expCounters = ctx.state.players[ctx.controller].counters?.experience ?? 0;
      if (expCounters > 0) {
        ctx.game.addMana(ctx.controller, 'R', expCounters);
      }
    },
    {
      isManaAbility: true,
      manaProduction: [{ amount: 1, colors: ['R'] }],
      description: 'Firebending X, where X is the number of experience counters you have.',
    },
  )
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.SPELL_CAST) return false;
        const castEvent = event as typeof event & { controller?: string };
        if (castEvent.controller !== source.controller) return false;
        // Check if we're in combat
        return game.currentPhase === 'COMBAT';
      },
    },
    (ctx) => {
      ctx.game.addPlayerCounters(ctx.controller, 'experience', 1);
    },
    { description: 'Whenever you cast a spell during combat, you get an experience counter.' },
  )
  .build();
