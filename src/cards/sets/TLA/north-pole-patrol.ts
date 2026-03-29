import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const NorthPolePatrol = CardBuilder.create('North Pole Patrol')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 3)
  .activated(
    { tap: true },
    async (ctx) => {
      const permanents = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId);
      if (permanents.length > 0) {
        const target = await ctx.choices.chooseOne('Untap another target permanent you control', permanents, c => c.definition.name);
        ctx.game.untapPermanent(target.objectId);
      }
    },
    { description: '{T}: Untap another target permanent you control.' },
  )
  .activated(
    { mana: parseManaCost('{3}'), tap: true, genericTapSubstitution: { amount: 3, filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' }, ignoreSummoningSickness: true } },
    async (ctx) => {
      const opponentCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
        .filter(c => c.controller !== ctx.controller);
      if (opponentCreatures.length > 0) {
        const target = await ctx.choices.chooseOne('Tap target creature an opponent controls', opponentCreatures, c => c.definition.name);
        ctx.game.tapPermanent(target.objectId);
      }
    },
    { description: 'Waterbend {3}, {T}: Tap target creature an opponent controls.' },
  )
  .build();
