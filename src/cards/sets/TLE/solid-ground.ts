import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SolidGround = CardBuilder.create('Solid Ground')
  .cost('{3}{G}')
  .types(CardType.ENCHANTMENT)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 3', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 3, ctx.controller);
    }
  }, { description: 'When this enchantment enters, earthbend 3.' })
  .staticAbility(
    {
      type: 'replacement',
      replaces: 'would-add-counters',
      replace: (_game, source, event) => {
        if (event.controller === source.controller && event.counterType === '+1/+1') {
          return {
            kind: 'add-counters',
            event: { ...event, amount: event.amount + 1 },
          };
        }
        return { kind: 'add-counters', event };
      },
    },
    { description: 'If one or more +1/+1 counters would be put on a permanent you control, that many plus one +1/+1 counters are put on it instead.' },
  )
  .build();
