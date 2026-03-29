import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const FireNationCadets = CardBuilder.create('Fire Nation Cadets')
  .cost('{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(1, 2)
  // TODO: Conditional firebending 2 when a Lesson card is in your graveyard
  .activated(
    { mana: parseManaCost('{2}') },
    async (ctx) => {
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 1, 0);
    },
    { description: '{2}: This creature gets +1/+0 until end of turn.' },
  )
  .build();
