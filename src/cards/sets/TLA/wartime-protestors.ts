import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard, getEffectiveSubtypes } from '../../../engine/GameState';
import { createHasteAbilities } from '../../../engine/AbilityPrimitives';

export const WartimeProtestors = CardBuilder.create('Wartime Protestors')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Rebel', 'Ally')
  .stats(4, 4)
  .haste()
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        const enterEvent = event as typeof event & { objectId: string; controller: string };
        if (enterEvent.controller !== source.controller) return false;
        if (enterEvent.objectId === source.objectId) return false;
        const card = findCard(game, enterEvent.objectId);
        return card ? getEffectiveSubtypes(card).includes('Ally') : false;
      },
    },
    (ctx) => {
      if (ctx.event && 'objectId' in ctx.event) {
        const enteredId = (ctx.event as typeof ctx.event & { objectId: string }).objectId;
        ctx.game.addCounters(enteredId, '+1/+1', 1);
        const card = ctx.game.getCard(enteredId);
        if (card) {
          ctx.game.grantAbilitiesUntilEndOfTurn(
            ctx.source.objectId,
            enteredId,
            card.zoneChangeCounter,
            createHasteAbilities(),
          );
        }
      }
    },
    { description: 'Whenever another Ally you control enters, put a +1/+1 counter on that creature and it gains haste until end of turn.' },
  )
  .build();
