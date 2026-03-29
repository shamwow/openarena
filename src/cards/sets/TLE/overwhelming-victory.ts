import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createTrampleAbilities } from '../../../engine/AbilityPrimitives';

export const OverwhelmingVictory = CardBuilder.create('Overwhelming Victory')
  .cost('{4}{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Deal 5 damage to target creature', creatures, c => c.definition.name);
    const toughness = target.modifiedToughness ?? target.definition.toughness ?? 0;
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, 5, false);
    const excess = Math.max(0, 5 - toughness);
    if (excess > 0) {
      const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
      for (const creature of myCreatures) {
        ctx.game.grantPumpToObjectsUntilEndOfTurn([creature.objectId], excess, 0);
        ctx.game.grantAbilitiesUntilEndOfTurn(
          ctx.source.objectId,
          creature.objectId,
          creature.zoneChangeCounter,
          createTrampleAbilities(),
        );
      }
    }
  }, { description: 'Overwhelming Victory deals 5 damage to target creature. Each creature you control gains trample and gets +X/+0 until end of turn, where X is the amount of excess damage dealt this way.' })
  .build();
