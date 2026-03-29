import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const LostInTheSpiritWorld = CardBuilder.create('Lost in the Spirit World')
  .cost('{2}{U}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Return up to one target creature to its owner\'s hand', creatures, 1, c => c.definition.name);
      for (const target of chosen) {
        ctx.game.returnToHand(target.objectId);
      }
    }
    ctx.game.createToken(ctx.controller, {
      name: 'Spirit',
      types: [CardType.CREATURE],
      subtypes: ['Spirit'],
      power: 1,
      toughness: 1,
      colorIdentity: [],
      // TODO: "This token can't block or be blocked by non-Spirit creatures."
    });
  }, { description: "Return up to one target creature to its owner's hand. Create a 1/1 colorless Spirit creature token." })
  .build();
