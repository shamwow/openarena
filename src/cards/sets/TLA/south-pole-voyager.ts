import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { getEffectiveSubtypes, findCard } from '../../../engine/GameState';

export const SouthPoleVoyager = CardBuilder.create('South Pole Voyager')
  .cost('{1}{W}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Scout', 'Ally')
  .stats(2, 2)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        const card = findCard(game, event.objectId, event.objectZoneChangeCounter);
        if (!card) return false;
        return card.objectId === source.objectId || getEffectiveSubtypes(card).includes('Ally');
      },
    },
    async (ctx) => {
      ctx.game.gainLife(ctx.controller, 1);
      // TODO: Track if this is the second time this ability has resolved this turn; if so, draw a card
    },
    { description: 'Whenever this creature or another Ally you control enters, you gain 1 life. If this is the second time this ability has resolved this turn, draw a card.' },
  )
  .build();
