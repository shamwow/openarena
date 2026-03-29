import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const RhysTheRedeemed = CardBuilder.create('Rhys the Redeemed')
  .cost('{G/W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Elf', 'Warrior')
  .stats(1, 1)
  .activated(
    { mana: parseManaCost('{2}{G/W}'), tap: true },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Elf Warrior',
        types: [CardType.CREATURE],
        subtypes: ['Elf', 'Warrior'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.GREEN, ManaColor.WHITE],
      });
    },
    { description: '{2}{G/W}, {T}: Create a 1/1 green and white Elf Warrior creature token.' },
  )
  .activated(
    { mana: parseManaCost('{4}{G/W}{G/W}'), tap: true },
    async (ctx) => {
      // For each creature token you control, create a token that's a copy of that creature
      const tokens = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you', isToken: true }, ctx.controller);
      for (const token of tokens) {
        ctx.game.createToken(ctx.controller, {
          name: token.definition.name,
          types: [...token.definition.types],
          subtypes: [...token.definition.subtypes],
          power: token.definition.power ?? 0,
          toughness: token.definition.toughness ?? 0,
          colorIdentity: [...token.definition.colorIdentity],
        });
      }
    },
    { description: '{4}{G/W}{G/W}, {T}: For each creature token you control, create a token that\'s a copy of that creature.' },
  )
  .build();
