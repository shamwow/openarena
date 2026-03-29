import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const VengefulVillagers = CardBuilder.create('Vengeful Villagers')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Citizen')
  .stats(3, 3)
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const oppCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => c.controller !== ctx.controller);
      if (oppCreatures.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose target creature an opponent controls to tap', oppCreatures, c => c.definition.name);
      ctx.game.tapPermanent(target.objectId);
      const wantSacrifice = await ctx.choices.chooseYesNo('Sacrifice an artifact or creature to put a stun counter on it?');
      if (wantSacrifice) {
        const sacrificeable = ctx.game.getBattlefield({
          types: [CardType.ARTIFACT, CardType.CREATURE],
          controller: 'you',
        }, ctx.controller);
        if (sacrificeable.length > 0) {
          const toSac = await ctx.choices.chooseOne('Choose an artifact or creature to sacrifice', sacrificeable, c => c.definition.name);
          ctx.game.sacrificePermanent(toSac.objectId, ctx.controller);
          ctx.game.addCounters(target.objectId, 'stun', 1);
        }
      }
    },
    { description: 'Whenever this creature attacks, choose target creature an opponent controls. Tap it, then you may sacrifice an artifact or creature. If you do, put a stun counter on the chosen creature.' },
  )
  .build();
