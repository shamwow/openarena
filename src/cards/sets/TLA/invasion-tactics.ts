import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const InvasionTactics = CardBuilder.create('Invasion Tactics')
  .cost('{4}{G}')
  .types(CardType.ENCHANTMENT)
  .etbEffect((ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    ctx.game.grantPumpToObjectsUntilEndOfTurn(creatures.map(c => c.objectId), 2, 2);
  }, { description: 'When this enchantment enters, creatures you control get +2/+2 until end of turn.' })
  .triggered(
    { on: 'deals-combat-damage-to-player', filter: { subtypes: ['Ally'], controller: 'you' } },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever one or more Allies you control deal combat damage to a player, draw a card.' },
  )
  .build();
