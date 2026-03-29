import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TophTheBlindBandit = CardBuilder.create('Toph, the Blind Bandit')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Warrior', 'Ally')
  .stats(0, 3)
  .etbEffect(async (ctx) => {
    const lands = ctx.game.getBattlefield({ types: [CardType.LAND], controller: 'you' }, ctx.controller);
    if (lands.length > 0) {
      const target = await ctx.choices.chooseOne('Choose a land to earthbend 2', lands, c => c.definition.name);
      ctx.game.earthbendLand(target.objectId, 2, ctx.controller);
    }
  }, { description: 'When Toph enters, earthbend 2.' })
  .staticAbility(
    {
      type: 'set-base-pt',
      power: (game, source) => {
        let counters = 0;
        for (const card of game.zones[source.controller].BATTLEFIELD) {
          if (card.definition.types.includes(CardType.LAND) && card.counters['+1/+1']) {
            counters += card.counters['+1/+1'];
          }
        }
        return counters;
      },
      toughness: 3,
      filter: { self: true },
      layer: 'cda',
    },
    { description: 'Toph\'s power is equal to the number of +1/+1 counters on lands you control.' },
  )
  .build();
