import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const JooDeeOneOfMany = CardBuilder.create('Joo Dee, One of Many')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Advisor')
  .stats(2, 2)
  .activated(
    { mana: parseManaCost('{B}'), tap: true },
    async (ctx) => {
      await ctx.game.surveil(ctx.controller, 1);
      // TODO: Create a token that's a copy of this creature, then sacrifice an artifact or creature
      // Copy-token creation is not fully supported
      ctx.game.createToken(ctx.controller, {
        name: 'Joo Dee, One of Many',
        types: [CardType.CREATURE as any],
        subtypes: ['Human', 'Advisor'],
        power: 2,
        toughness: 2,
        colorIdentity: ['B' as any],
      });
      const sacrificeCandidates = ctx.game.getBattlefield(
        { types: [CardType.ARTIFACT as any, CardType.CREATURE as any], controller: 'you' },
        ctx.controller,
      );
      if (sacrificeCandidates.length > 0) {
        const toSac = await ctx.choices.chooseOne(
          'Sacrifice an artifact or creature',
          sacrificeCandidates,
          c => c.definition.name,
        );
        ctx.game.sacrificePermanent(toSac.objectId, ctx.controller);
      }
    },
    { timing: 'sorcery', description: '{B}, {T}: Surveil 1. Create a token that\'s a copy of this creature, then sacrifice an artifact or creature. Activate only as a sorcery.' },
  )
  .build();
