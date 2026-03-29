import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const FirebenderAscension = CardBuilder.create('Firebender Ascension')
  .cost('{1}{R}')
  .types(CardType.ENCHANTMENT)
  .etbEffect((ctx) => {
    ctx.game.createToken(ctx.controller, {
      name: 'Soldier',
      types: [CardType.CREATURE],
      subtypes: ['Soldier'],
      power: 2,
      toughness: 2,
      colorIdentity: [ManaColor.RED],
      abilities: [],
    });
    // TODO: Token should have firebending 1
  }, { description: 'When this enchantment enters, create a 2/2 red Soldier creature token with firebending 1.' })
  // TODO: Whenever a creature you control attacking causes a triggered ability to trigger,
  // put a quest counter on this. If four or more quest counters, copy that ability with new targets.
  .triggered(
    { on: 'attacks', filter: { types: [CardType.CREATURE], controller: 'you' } },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, 'quest', 1);
      // TODO: Check if 4+ quest counters and copy the triggered ability
    },
    { description: 'Whenever a creature you control attacking causes a triggered ability of that creature to trigger, put a quest counter on this enchantment. Then if it has four or more quest counters on it, you may copy that ability.' },
  )
  .build();
