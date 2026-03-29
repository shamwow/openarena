import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const RuthlessWaterbender = CardBuilder.create('Ruthless Waterbender')
  .cost('{1}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(1, 3)
  .activated(
    { mana: parseManaCost('{2}'), genericTapSubstitution: { amount: 2, filter: { types: ['Artifact' as any, 'Creature' as any], controller: 'you' }, ignoreSummoningSickness: true } },
    async (ctx) => {
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 1, 1);
    },
    {
      activateOnlyDuringYourTurn: true,
      description: 'Waterbend {2}: This creature gets +1/+1 until end of turn. Activate only during your turn.',
    },
  )
  .build();
