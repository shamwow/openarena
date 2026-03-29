import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard } from '../../../engine/GameState';

export const IntruderAlarm = CardBuilder.create('Intruder Alarm')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  .staticAbility(
    {
      type: 'replacement',
      replaces: GameEventType.UNTAPPED,
      condition: (game, _source, event) => {
        if (!('isUntapStep' in event) || !event.isUntapStep) return false;
        if (!('objectId' in event)) return false;
        const card = findCard(game, event.objectId as string);
        return card?.definition.types.includes(CardType.CREATURE) ?? false;
      },
      replace: () => null,
    },
    { description: "Creatures don't untap during their controllers' untap steps." },
  )
  .triggered(
    {
      on: 'custom',
      match: (event) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        return event.types?.includes('Creature' as CardType) ?? false;
      },
    },
    (ctx) => {
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      for (const creature of creatures) {
        ctx.game.untapPermanent(creature.objectId);
      }
    },
    { description: 'Whenever a creature enters, untap all creatures.' },
  )
  .build();
