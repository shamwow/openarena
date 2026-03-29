import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard, getEffectiveSubtypes, hasType } from '../../../engine/GameState';

export const TheSpiritOasis = CardBuilder.create('The Spirit Oasis')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .supertypes('Legendary')
  .subtypes('Shrine')
  .etbEffect((ctx) => {
    const shrines = ctx.game.getBattlefield({
      subtypes: ['Shrine'],
      controller: 'you',
    }, ctx.controller);
    ctx.game.drawCards(ctx.controller, shrines.length);
  }, { description: 'When The Spirit Oasis enters, draw a card for each Shrine you control.' })
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (event.controller !== source.controller) return false;
        if (event.objectId === source.objectId) return false;
        const enteringCard = findCard(game, event.objectId, event.objectZoneChangeCounter);
        return Boolean(enteringCard && getEffectiveSubtypes(enteringCard).includes('Shrine'));
      },
    },
    (ctx) => {
      ctx.game.drawCards(ctx.controller, 1);
    },
    { description: 'Whenever another Shrine you control enters, draw a card.' },
  )
  .build();
