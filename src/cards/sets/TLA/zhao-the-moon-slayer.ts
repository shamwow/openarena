import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const ZhaoTheMoonSlayer = CardBuilder.create('Zhao, the Moon Slayer')
  .cost('{1}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Soldier')
  .stats(2, 2)
  .menace()
  .staticAbility(
    {
      type: 'custom',
      apply: (_game, _source) => {
        // TODO: Nonbasic lands enter tapped
      },
    },
    { description: 'Nonbasic lands enter tapped.' },
  )
  .activated(
    { mana: parseManaCost('{7}') },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'conqueror', 1);
    },
    { description: '{7}: Put a conqueror counter on Zhao.' },
  )
  .staticAbility(
    {
      type: 'custom',
      apply: (_game, source) => {
        if ((source.counters['conqueror'] ?? 0) > 0) {
          // TODO: Nonbasic lands are Mountains (lose all other land types and abilities, gain "{T}: Add {R}")
        }
      },
    },
    {
      condition: (_game, source) => (source.counters['conqueror'] ?? 0) > 0,
      description: 'As long as Zhao has a conqueror counter on him, nonbasic lands are Mountains.',
    },
  )
  .build();
