import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const InvasionSubmersible = CardBuilder.create('Invasion Submersible')
  .cost('{2}{U}')
  .types(CardType.ARTIFACT)
  .subtypes('Vehicle')
  .stats(0, 0)
  .etbEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield()
      .filter(c => c.objectId !== ctx.source.objectId && !c.definition.types.includes(CardType.LAND));
    if (targets.length === 0) return;
    const chosen = await ctx.choices.chooseUpToN('Return up to one other target nonland permanent to its owner\'s hand', targets, 1, c => c.definition.name);
    for (const target of chosen) {
      ctx.game.moveCard(target.objectId, 'HAND', target.owner);
    }
  }, { description: "When this Vehicle enters, return up to one other target nonland permanent to its owner's hand." })
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
      // TODO: Properly turn Vehicle into artifact creature
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 3);
    },
    {
      isExhaust: true,
      description: 'Exhaust \u2014 Waterbend {3}: This Vehicle becomes an artifact creature. Put three +1/+1 counters on it.',
    },
  )
  .build();
