import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const YueTheMoonSpirit = CardBuilder.create('Yue, the Moon Spirit')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Spirit', 'Ally')
  .stats(3, 3)
  .flying()
  .vigilance()
  .activated(
    { tap: true },
    async (ctx) => {
      // Cast a noncreature spell from hand without paying its mana cost
      const hand = ctx.game.getHand(ctx.controller);
      const noncreatureSpells = hand.filter(c =>
        !c.definition.types.includes(CardType.CREATURE) &&
        !c.definition.types.includes(CardType.LAND),
      );
      if (noncreatureSpells.length > 0) {
        const chosen = await ctx.choices.chooseOne('Cast a noncreature spell without paying its mana cost', noncreatureSpells, c => c.definition.name);
        await ctx.game.castWithoutPayingManaCost(chosen.objectId, ctx.controller);
      }
    },
    {
      description: 'Waterbend {5}, {T}: You may cast a noncreature spell from your hand without paying its mana cost.',
    },
  )
  .waterbend(5)
  .build();
