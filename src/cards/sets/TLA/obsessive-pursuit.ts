import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { createLifelinkAbilities } from '../../../engine/AbilityPrimitives';

export const ObsessivePursuit = CardBuilder.create('Obsessive Pursuit')
  .cost('{1}{B}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    { on: 'enter-battlefield', filter: { self: true } },
    (ctx) => {
      ctx.game.loseLife(ctx.controller, 1);
      ctx.game.createPredefinedToken(ctx.controller, 'Clue');
    },
    { description: 'When this enchantment enters, you lose 1 life and create a Clue token.' },
  )
  .triggered(
    { on: 'upkeep', whose: 'yours' },
    (ctx) => {
      ctx.game.loseLife(ctx.controller, 1);
      ctx.game.createPredefinedToken(ctx.controller, 'Clue');
    },
    { description: 'At the beginning of your upkeep, you lose 1 life and create a Clue token.' },
  )
  .triggered(
    { on: 'attacks' },
    async (ctx) => {
      const sacrificedThisTurn = (ctx.state.eventLog ?? []).filter(
        e => e.type === GameEventType.SACRIFICED && (e as any).controller === ctx.controller && (e as any).turn === ctx.state.turn,
      ).length;
      if (sacrificedThisTurn > 0) {
        const attacking = ctx.game.getBattlefield({ types: [CardType.CREATURE], tapped: true, controller: 'you' }, ctx.controller);
        if (attacking.length > 0) {
          const target = await ctx.choices.chooseOne('Put counters on target attacking creature', attacking, c => c.definition.name);
          ctx.game.addCounters(target.objectId, '+1/+1', sacrificedThisTurn);
          if (sacrificedThisTurn >= 3) {
            ctx.game.grantAbilitiesUntilEndOfTurn(
              ctx.source.objectId,
              target.objectId,
              target.zoneChangeCounter,
              createLifelinkAbilities(),
            );
          }
        }
      }
    },
    { description: 'Whenever you attack, put X +1/+1 counters on target attacking creature, where X is the number of permanents you\'ve sacrificed this turn. If X is three or greater, that creature gains lifelink until end of turn.' },
  )
  .build();
