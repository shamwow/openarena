import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const PiratePeddlers = CardBuilder.create('Pirate Peddlers')
  .cost('{2}{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Pirate')
  .stats(2, 2)
  .deathtouch()
  .triggered(
    {
      on: 'custom',
      match: (event, source, _game) => {
        if (event.type !== GameEventType.SACRIFICED) return false;
        return (event as any).controller === source.controller && (event as any).objectId !== source.objectId;
      },
    },
    (ctx) => {
      ctx.game.addCounters(ctx.source.objectId, '+1/+1', 1);
    },
    { description: 'Whenever you sacrifice another permanent, put a +1/+1 counter on this creature.' },
  )
  .build();
