import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FlexibleWaterbender = CardBuilder.create('Flexible Waterbender')
  .cost('{3}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(2, 5)
  .vigilance()
  .activated(
    {
      mana: parseManaCost('{3}'),
      genericTapSubstitution: {
        amount: 3,
        filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' },
        ignoreSummoningSickness: true,
      },
    },
    (ctx) => {
      // TODO: Properly set base power/toughness to 5/2 until end of turn
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 3, -3);
    },
    { description: 'Waterbend {3}: This creature has base power and toughness 5/2 until end of turn.' },
  )
  .build();
