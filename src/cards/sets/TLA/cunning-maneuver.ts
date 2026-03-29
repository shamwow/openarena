import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CunningManeuver = CardBuilder.create('Cunning Maneuver')
  .cost('{1}{R}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Target creature gets +3/+1', creatures, c => c.definition.name);
      ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 3, 1);
    }
    // Create a Clue token
    ctx.game.createToken(ctx.controller, {
      name: 'Clue',
      types: [CardType.ARTIFACT],
      subtypes: ['Clue'],
      abilities: [{
        kind: 'activated' as const,
        cost: { mana: { generic: 2, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, sacrifice: { self: true } },
        effect: (innerCtx) => {
          innerCtx.game.drawCards(innerCtx.controller, 1);
        },
        timing: 'instant' as const,
        isManaAbility: false,
        description: '{2}, Sacrifice this token: Draw a card.',
      }],
    });
  }, { description: 'Target creature gets +3/+1 until end of turn. Create a Clue token.' })
  .build();
