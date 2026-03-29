import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard } from '../../../engine/GameState';

export const WarstormSurge = CardBuilder.create('Warstorm Surge')
  .cost('{5}{R}')
  .types(CardType.ENCHANTMENT)
  .triggered(
    {
      on: 'custom',
      match: (event, source, game) => {
        if (event.type !== GameEventType.ENTERS_BATTLEFIELD) return false;
        const enterEvent = event as typeof event & { objectId: string; controller: string };
        if (enterEvent.controller !== source.controller) return false;
        const card = findCard(game, enterEvent.objectId);
        return card ? card.definition.types.includes('Creature' as CardType) : false;
      },
    },
    async (ctx) => {
      const power = ctx.event && 'objectId' in ctx.event
        ? (() => {
            const card = ctx.game.getCard((ctx.event as typeof ctx.event & { objectId: string }).objectId);
            return card ? (card.modifiedPower ?? card.definition.power ?? 0) : 0;
          })()
        : 0;
      if (power <= 0) return;
      // Deal damage to any target
      const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
      const opponents = ctx.game.getOpponents(ctx.controller);
      const allTargets = [
        ...creatures.map(c => ({ label: c.definition.name, value: c.objectId as string })),
        ...opponents.map(p => ({ label: `Player ${p}`, value: p })),
      ];
      if (allTargets.length > 0) {
        const target = await ctx.choices.chooseOne(`Deal ${power} damage to any target`, allTargets, t => t.label);
        ctx.game.dealDamage(ctx.source.objectId, target.value, power, false);
      }
    },
    { description: 'Whenever a creature you control enters, it deals damage equal to its power to any target.' },
  )
  .build();
