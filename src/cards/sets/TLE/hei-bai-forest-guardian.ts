import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const HeiBaiForestGuardian = CardBuilder.create('Hei Bai, Forest Guardian')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Bear', 'Spirit')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const revealed: typeof library = [];
    let shrineCard = null;
    for (const card of library) {
      revealed.push(card);
      if (card.definition.subtypes.includes('Shrine')) {
        shrineCard = card;
        break;
      }
    }
    if (shrineCard) {
      const put = await ctx.choices.chooseYesNo(`Put ${shrineCard.definition.name} onto the battlefield?`);
      if (put) {
        ctx.game.moveCard(shrineCard.objectId, 'BATTLEFIELD', ctx.controller);
      }
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'When Hei Bai enters, reveal cards from the top of your library until you reveal a Shrine card. You may put that card onto the battlefield. Then shuffle.' })
  .activated(
    { mana: parseManaCost('{W}{U}{B}{R}{G}'), tap: true },
    (ctx) => {
      const legendaryEnchantments = ctx.game.getBattlefield({ types: [CardType.ENCHANTMENT], controller: 'you' }, ctx.controller)
        .filter(c => c.definition.supertypes.includes('Legendary'));
      for (let i = 0; i < legendaryEnchantments.length; i++) {
        ctx.game.createToken(ctx.controller, {
          name: 'Spirit',
          types: [CardType.CREATURE],
          subtypes: ['Spirit'],
          power: 1,
          toughness: 1,
          colorIdentity: [],
          abilities: [],
          // TODO: "This token can't block or be blocked by non-Spirit creatures."
        });
      }
    },
    { description: '{W}{U}{B}{R}{G}, {T}: For each legendary enchantment you control, create a 1/1 colorless Spirit creature token.' },
  )
  .build();
