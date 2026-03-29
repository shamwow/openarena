import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const RealmOfKoh = CardBuilder.create('Realm of Koh')
  .types(CardType.LAND)
  .entersTappedUnlessYouControl({ supertypes: ['Basic'] })
  .tapForMana('B')
  .activated(
    { mana: parseManaCost('{3}{B}'), tap: true },
    async (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Spirit',
        types: [CardType.CREATURE],
        subtypes: ['Spirit'],
        power: 1,
        toughness: 1,
        colorIdentity: [],
        // TODO: "This token can't block or be blocked by non-Spirit creatures."
      });
    },
    { description: '{3}{B}, {T}: Create a 1/1 colorless Spirit creature token with "This token can\'t block or be blocked by non-Spirit creatures."' },
  )
  .build();
