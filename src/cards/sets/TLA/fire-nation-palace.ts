import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FireNationPalace = CardBuilder.create('Fire Nation Palace')
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({ supertypes: ['Basic'] })
  .tapForMana('R')
  .activated(
    { mana: parseManaCost('{1}{R}'), tap: true },
    async (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      if (creatures.length === 0) return;
      const target = await ctx.choices.chooseOne('Choose target creature you control', creatures, c => c.definition.name);
      // TODO: Grant firebending 4 until end of turn to target
      void target;
    },
    { description: '{1}{R}, {T}: Target creature you control gains firebending 4 until end of turn.' },
  )
  .build();
