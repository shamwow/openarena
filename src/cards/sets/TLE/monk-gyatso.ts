import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const MonkGyatso = CardBuilder.create('Monk Gyatso')
  .cost('{3}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Monk')
  .stats(3, 3)
  .triggered(
    {
      on: 'custom',
      match: (event, source, _game) => {
        // TODO: Whenever another creature you control becomes the target of a spell or ability
        return false;
      },
    },
    async (ctx) => {
      // TODO: Airbend that creature (exile it, while exiled owner may cast for {2})
    },
    { optional: true, description: 'Whenever another creature you control becomes the target of a spell or ability, you may airbend that creature.' },
  )
  .build();
