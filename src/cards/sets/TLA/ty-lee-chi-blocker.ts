import { CardBuilder } from '../../CardBuilder';
import { CardType, GameEventType } from '../../../engine/types';
import { findCard } from '../../../engine/GameState';

const LOCK_PREFIX = 'locked-by-ty-lee:';

export const TyLeeChiBlocker = CardBuilder.create('Ty Lee, Chi Blocker')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Performer', 'Ally')
  .supertypes('Legendary')
  .stats(2, 1)
  .flash()
  .prowess()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE as any] })
      .filter(c => c.objectId !== ctx.source.objectId);
    if (creatures.length > 0) {
      const targets = await ctx.choices.chooseUpToN('Tap up to one target creature', creatures, 1, c => c.definition.name);
      for (const target of targets) {
        ctx.game.tapPermanent(target.objectId);
        ctx.game.addCounters(target.objectId, `${LOCK_PREFIX}${ctx.source.objectId}`, 1);
      }
    }
  }, { description: "When Ty Lee enters, tap up to one target creature. It doesn't untap during its controller's untap step for as long as you control Ty Lee." })
  .staticAbility(
    {
      type: 'replacement',
      replaces: GameEventType.UNTAPPED,
      condition: (game, source, event) => {
        if (!('isUntapStep' in event) || !event.isUntapStep) return false;
        if (!('objectId' in event)) return false;
        const card = findCard(game, event.objectId as string);
        if (!card) return false;
        return (card.counters[`${LOCK_PREFIX}${source.objectId}`] ?? 0) > 0;
      },
      replace: () => null,
    },
    { description: "Locked creature doesn't untap during its controller's untap step for as long as you control Ty Lee." },
  )
  .diesEffect((ctx) => {
    // Clean up lock counters when Ty Lee leaves the battlefield
    const allCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE as any] });
    const lockKey = `${LOCK_PREFIX}${ctx.source.objectId}`;
    for (const creature of allCreatures) {
      if ((creature.counters[lockKey] ?? 0) > 0) {
        ctx.game.removeCounters(creature.objectId, lockKey, creature.counters[lockKey]);
      }
    }
  }, { description: 'When Ty Lee leaves the battlefield, unlock locked creatures.' })
  .build();
