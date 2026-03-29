import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FireNationTurret = CardBuilder.create('Fire Nation Turret')
  .cost('{2}{R}')
  .types(CardType.ARTIFACT)
  .triggered(
    { on: 'step', step: 'COMBAT_BEGIN', whose: 'yours' },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length === 0) return;
      const chosen = await ctx.choices.chooseUpToN('Choose up to one target creature', creatures, 1, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 0);
        // TODO: Grant firebending 2 until end of turn
      }
    },
    { description: 'At the beginning of combat on your turn, up to one target creature gets +2/+0 and gains firebending 2 until end of turn.' },
  )
  .activated(
    { mana: parseManaCost('{R}') },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'charge', 1);
    },
    { description: '{R}: Put a charge counter on this artifact.' },
  )
  .activated(
    { custom: (_game, source) => (source.counters['charge'] ?? 0) >= 50 },
    async (ctx) => {
      // Remove fifty charge counters
      ctx.game.addCounters(ctx.source.objectId, 'charge', -50);
      // Deal 50 damage to any target
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      const opponents = ctx.game.getOpponents(ctx.controller);
      // TODO: Allow targeting any target (creature or player)
      if (creatures.length > 0) {
        const target = await ctx.choices.chooseOne('Deal 50 damage to target', creatures, c => c.definition.name);
        ctx.game.dealDamage(ctx.source.objectId, target.objectId, 50, false);
      }
    },
    { description: 'Remove fifty charge counters from this artifact: It deals 50 damage to any target.' },
  )
  .build();
