import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const MessengerHawk = CardBuilder.create('Messenger Hawk')
  .cost('{2}{U/B}')
  .types(CardType.CREATURE)
  .subtypes('Bird', 'Scout')
  .stats(1, 2)
  .flying()
  .etbEffect((ctx) => {
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this creature enters, create a Clue token.' })
  .staticAbility(
    {
      type: 'custom',
      apply: (game, source) => {
        const drawCount = game.eventLog?.filter(
          e => e.type === GameEventType.DREW_CARD && e.player === source.controller && e.turn === game.turn,
        ).length ?? 0;
        if (drawCount >= 2) {
          source.modifiedPower = (source.modifiedPower ?? source.definition.power ?? 0) + 2;
        }
      },
    },
    { description: 'This creature gets +2/+0 as long as you\'ve drawn two or more cards this turn.' },
  )
  .build();
