import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard, getEffectiveSubtypes } from '../../../engine/GameState';

export const NorthernAirTemple = CardBuilder.create('Northern Air Temple')
  .cost('{B}')
  .types(CardType.ENCHANTMENT)
  .supertypes('Legendary')
  .subtypes('Shrine')
  .etbEffect((ctx) => {
    const shrines = ctx.game.getBattlefield({ subtypes: ['Shrine'], controller: 'you' }, ctx.controller);
    const x = shrines.length;
    for (const opponent of ctx.game.getOpponents(ctx.controller)) {
      ctx.game.loseLife(opponent, x);
    }
    ctx.game.gainLife(ctx.controller, x);
  }, { description: 'When Northern Air Temple enters, each opponent loses X life and you gain X life, where X is the number of Shrines you control.' })
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
      for (const opponent of ctx.game.getOpponents(ctx.controller)) {
        ctx.game.loseLife(opponent, 1);
      }
      ctx.game.gainLife(ctx.controller, 1);
    },
    { description: 'Whenever another Shrine you control enters, each opponent loses 1 life and you gain 1 life.' },
  )
  .build();
