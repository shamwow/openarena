import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';

export const IntruderAlarm = CardBuilder.create('Intruder Alarm')
  .cost('{2}{U}')
  .types(CardType.ENCHANTMENT)
  // TODO: Creatures don't untap during their controllers' untap steps
  .staticAbility(
    {
      type: 'custom',
      apply: () => {
        // TODO: Prevent creatures from untapping during untap step
      },
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
