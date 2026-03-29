import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { createMenaceAbilities } from '../../../engine/AbilityPrimitives';

export const HowToStartARiot = CardBuilder.create('How to Start a Riot')
  .cost('{2}{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // Target creature gains menace until end of turn
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Choose target creature to gain menace', creatures, c => c.definition.name);
      ctx.game.grantAbilitiesUntilEndOfTurn(
        ctx.source.objectId,
        target.objectId,
        target.zoneChangeCounter,
        createMenaceAbilities(),
      );
    }
    // Creatures target player controls get +2/+0 until end of turn
    const allPlayers = [ctx.controller, ...ctx.game.getOpponents(ctx.controller)];
    const targetPlayer = await ctx.choices.choosePlayer('Choose target player', allPlayers);
    const playerCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.controller === targetPlayer);
    ctx.game.grantPumpToObjectsUntilEndOfTurn(playerCreatures.map(c => c.objectId), 2, 0);
  }, { description: 'Target creature gains menace until end of turn. Creatures target player controls get +2/+0 until end of turn.' })
  .build();
