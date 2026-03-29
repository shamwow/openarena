import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const AangAndKatara = CardBuilder.create('Aang and Katara')
  .cost('{3}{G}{W}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(5, 5)
  .triggered(
    { on: 'enter-battlefield', filter: { self: true } },
    async (ctx) => {
      const battlefield = ctx.game.getBattlefield(
        { controller: 'you', tapped: true, custom: (c) => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.CREATURE) },
        ctx.controller,
      );
      const count = battlefield.length;
      for (let i = 0; i < count; i++) {
        ctx.game.createToken(ctx.controller, {
          name: 'Ally',
          types: [CardType.CREATURE],
          subtypes: ['Ally'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.WHITE],
        });
      }
    },
    { description: 'Whenever Aang and Katara enter or attack, create X 1/1 white Ally creature tokens, where X is the number of tapped artifacts and/or creatures you control.' },
  )
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const battlefield = ctx.game.getBattlefield(
        { controller: 'you', tapped: true, custom: (c) => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.CREATURE) },
        ctx.controller,
      );
      const count = battlefield.length;
      for (let i = 0; i < count; i++) {
        ctx.game.createToken(ctx.controller, {
          name: 'Ally',
          types: [CardType.CREATURE],
          subtypes: ['Ally'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.WHITE],
        });
      }
    },
    { description: 'Whenever Aang and Katara enter or attack, create X 1/1 white Ally creature tokens.' },
  )
  .build();
