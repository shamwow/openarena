import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationEngineer = CardBuilder.create('Fire Nation Engineer')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Artificer')
  .stats(2, 3)
  .triggered(
    { on: 'end-step', whose: 'yours' },
    async (ctx) => {
      const candidates = ctx.game.getBattlefield(
        { types: [CardType.CREATURE as any], controller: 'you' },
        ctx.controller,
      ).filter(c => c.objectId !== ctx.source.objectId);
      if (candidates.length > 0) {
        const target = await ctx.choices.chooseOne(
          'Choose a creature to put a +1/+1 counter on',
          candidates,
          c => c.definition.name,
        );
        ctx.game.addCounters(target.objectId, '+1/+1', 1, {
          player: ctx.controller,
          sourceId: ctx.source.objectId,
          sourceCardId: ctx.source.cardId,
          sourceZoneChangeCounter: ctx.source.zoneChangeCounter,
        });
      }
    },
    {
      interveningIf: (game, source) => game.eventLog.some(
        (e: any) => e.type === 'ATTACKS' && e.lastKnownInfo?.controller === source.controller,
      ),
      description: 'Raid — At the beginning of your end step, if you attacked this turn, put a +1/+1 counter on another target creature or Vehicle you control.',
    },
  )
  .build();
