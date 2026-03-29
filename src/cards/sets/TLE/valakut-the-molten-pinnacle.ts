import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard, getEffectiveSubtypes } from '../../../engine/GameState';

export const ValakutTheMoltenPinnacle = CardBuilder.create('Valakut, the Molten Pinnacle')
  .types(CardType.LAND)
  .entersTapped()
  .tapForMana('R')
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        if (!('objectId' in event) || !('controller' in event)) return false;
        const enterEvent = event as typeof event & { objectId: string; controller: string };
        if (enterEvent.controller !== source.controller) return false;
        const card = findCard(game, enterEvent.objectId);
        if (!card) return false;
        if (!getEffectiveSubtypes(card).includes('Mountain')) return false;
        // Check if you control at least five other Mountains
        const mountains = game.zones[source.controller].BATTLEFIELD.filter(c =>
          c.objectId !== enterEvent.objectId && getEffectiveSubtypes(c).includes('Mountain'),
        );
        return mountains.length >= 5;
      },
    },
    async (ctx) => {
      // Deal 3 damage to any target
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      const opponents = ctx.game.getOpponents(ctx.controller);
      const allTargets = [
        ...creatures.map(c => ({ label: c.definition.name, value: c.objectId as string })),
        ...opponents.map(p => ({ label: `Player ${p}`, value: p })),
      ];
      if (allTargets.length > 0) {
        const target = await ctx.choices.chooseOne('Deal 3 damage to any target', allTargets, t => t.label);
        ctx.game.dealDamage(ctx.source.objectId, target.value, 3, false);
      }
    },
    { optional: true, description: 'Whenever a Mountain you control enters, if you control at least five other Mountains, you may have this land deal 3 damage to any target.' },
  )
  .build();
