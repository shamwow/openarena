import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const OtterPenguin = CardBuilder.create('Otter-Penguin')
  .cost('{1}{U}')
  .types(CardType.CREATURE)
  .subtypes('Otter', 'Bird')
  .stats(2, 1)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.DREW_CARD) return false;
        if ((event as any).player !== source.controller) return false;
        const drawCount = game.eventLog?.filter(
          e => e.type === GameEventType.DREW_CARD && (e as any).player === source.controller && (e as any).turn === game.turn,
        ).length ?? 0;
        return drawCount === 2;
      },
    },
    (ctx) => {
      ctx.game.grantPumpToObjectsUntilEndOfTurn([ctx.source.objectId], 1, 2);
      // TODO: Can't be blocked this turn
    },
    { description: 'Whenever you draw your second card each turn, this creature gets +1/+2 until end of turn and can\'t be blocked this turn.' },
  )
  .build();
