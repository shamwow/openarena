import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SokkasSwordTraining = CardBuilder.create("Sokka's Sword Training")
  .cost('{1}{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
      ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
    }
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'Target creature gets +2/+2 until end of turn. Create a Clue token.' })
  .build();
