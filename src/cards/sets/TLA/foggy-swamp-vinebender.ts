import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FoggySwampVinebender = CardBuilder.create('Foggy Swamp Vinebender')
  .cost('{3}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Plant', 'Ally')
  .stats(4, 3)
  // TODO: Can't be blocked by creatures with power 2 or less
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Evasion - can't be blocked by creatures with power 2 or less
      },
    },
    { description: "This creature can't be blocked by creatures with power 2 or less." },
  )
  .activated(
    {
      mana: parseManaCost('{5}'),
      genericTapSubstitution: {
        amount: 5,
        filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' },
        ignoreSummoningSickness: true,
        keywordAction: 'waterbend',
      },
    },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
    },
    {
      activateOnlyDuringYourTurn: true,
      description: 'Waterbend {5}: Put a +1/+1 counter on this creature. Activate only during your turn.',
    },
  )
  .build();
