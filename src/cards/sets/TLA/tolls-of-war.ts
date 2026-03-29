import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor, GameEventType } from '../../../engine/types';

export const TollsOfWar = CardBuilder.create('Tolls of War')
  .cost('{W}{B}')
  .types(CardType.ENCHANTMENT)
  .etbEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this enchantment enters, create a Clue token.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.SACRIFICED) return false;
        if (!('controller' in event)) return false;
        const sacEvent = event as typeof event & { controller: string };
        if (sacEvent.controller !== source.controller) return false;
        // Check if it's during your turn
        return game.activePlayer === source.controller;
      },
    },
    (ctx) => {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    },
    { oncePerTurn: true, description: 'Whenever you sacrifice a permanent during your turn, create a 1/1 white Ally creature token. This ability triggers only once each turn.' },
  )
  .build();
