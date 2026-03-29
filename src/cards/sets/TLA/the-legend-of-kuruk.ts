import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

const AvatarKuruk = CardBuilder.create('Avatar Kuruk')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Avatar')
  .stats(4, 3)
  .triggered(
    { on: 'cast-spell', filter: { controller: 'you' } },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Spirit',
        types: [CardType.CREATURE],
        subtypes: ['Spirit'],
        power: 1,
        toughness: 1,
        colorIdentity: [],
      });
    },
    { description: 'Whenever you cast a spell, create a 1/1 colorless Spirit creature token.' },
  )
  .activated(
    {
      mana: parseManaCost('{20}'),
      genericTapSubstitution: {
        amount: 20,
        filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' },
        ignoreSummoningSickness: true,
        keywordAction: 'waterbend',
      },
    },
    (ctx) => {
      ctx.game.grantExtraTurn(ctx.controller);
    },
    { isExhaust: true, description: 'Exhaust — Waterbend {20}: Take an extra turn after this one.' },
  )
  .build();

export const TheLegendOfKuruk = CardBuilder.create('The Legend of Kuruk')
  .cost('{2}{U}{U}')
  .types(CardType.ENCHANTMENT)
  .subtypes('Saga')
  .saga([
    {
      chapter: 1,
      effect: async (ctx) => {
        await ctx.game.scry(ctx.controller, 2);
        ctx.game.drawCards(ctx.controller, 1);
      },
    },
    {
      chapter: 2,
      effect: async (ctx) => {
        await ctx.game.scry(ctx.controller, 2);
        ctx.game.drawCards(ctx.controller, 1);
      },
    },
    {
      chapter: 3,
      effect: (ctx) => {
        ctx.game.moveCard(ctx.source.objectId, 'EXILE', ctx.controller);
        ctx.game.moveCard(ctx.source.objectId, 'BATTLEFIELD', ctx.controller, { transformed: true });
      },
    },
  ])
  .transform(AvatarKuruk)
  .build();
