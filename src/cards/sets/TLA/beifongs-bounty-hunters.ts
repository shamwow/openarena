import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BeifongsBountyHunters = CardBuilder.create("Beifong's Bounty Hunters")
  .cost('{2}{B}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Mercenary')
  .stats(4, 4)
  .triggered(
    { on: 'dies', filter: { types: [CardType.CREATURE], controller: 'you' } },
    async (ctx) => {
      // Get the dying creature's power
      const diedCard = ctx.event && 'lastKnownInformation' in ctx.event
        ? (ctx.event as any).lastKnownInformation
        : null;
      const power = diedCard?.modifiedPower ?? diedCard?.definition?.power ?? 0;
      if (power <= 0) return;
      // Filter out lands (earthbend X only for nonland creatures dying)
      if (diedCard?.definition?.types?.includes(CardType.LAND)) return;
      const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
      if (lands.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a land to earthbend', lands, c => c.definition.name);
        ctx.game.earthbendLand(target.objectId, power, ctx.controller);
      }
    },
    { description: 'Whenever a nonland creature you control dies, earthbend X, where X is that creature\'s power.' }
  )
  .build();
