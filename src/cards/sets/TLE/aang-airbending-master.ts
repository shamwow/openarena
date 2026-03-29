import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, parseManaCost } from '../../../engine/types';

export const AangAirbendingMaster = CardBuilder.create('Aang, Airbending Master')
  .cost('{4}{W}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Avatar', 'Ally')
  .stats(4, 4)
  .etbEffect(async (ctx) => {
    // Airbend another target creature
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(
      c => c.objectId !== ctx.source.objectId,
    );
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Airbend another target creature', creatures, c => c.definition.name);
      ctx.game.airbendObject(target.objectId, { mana: parseManaCost('{2}') }, ctx.controller);
    }
  }, { description: 'When Aang enters, airbend another target creature.' })
  .triggered(
    {
      on: 'leave-battlefield',
      filter: { types: [CardType.CREATURE], controller: 'you' },
    },
    async (ctx) => {
      // TODO: Check "without dying" condition - currently triggers on any leave
      ctx.game.addPlayerCounters(ctx.controller, 'experience', 1);
    },
    { description: 'Whenever one or more creatures you control leave the battlefield without dying, you get an experience counter.' },
  )
  .triggered(
    { on: 'upkeep', whose: 'yours' },
    (ctx) => {
      const expCounters = ctx.state.players[ctx.controller].counters?.experience ?? 0;
      for (let i = 0; i < expCounters; i++) {
        ctx.game.createToken(ctx.controller, {
          name: 'Ally',
          types: [CardType.CREATURE],
          subtypes: ['Ally'],
          power: 1,
          toughness: 1,
          colorIdentity: [ManaColor.WHITE],
        });
      }
    },
    { description: 'At the beginning of your upkeep, create a 1/1 white Ally creature token for each experience counter you have.' },
  )
  .build();
