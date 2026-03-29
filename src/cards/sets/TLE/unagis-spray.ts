import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const UnagisSpray = CardBuilder.create("Unagi's Spray")
  .cost('{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Target creature gets -4/-0', creatures, c => c.definition.name);
      ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], -4, 0);
    }
    // Check if you control a Fish, Octopus, Otter, Seal, Serpent, or Whale
    const aquaticTypes = ['Fish', 'Octopus', 'Otter', 'Seal', 'Serpent', 'Whale'];
    const myCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    const hasAquatic = myCreatures.some(c =>
      aquaticTypes.some(t => c.definition.subtypes?.includes(t)),
    );
    if (hasAquatic) {
      ctx.game.drawCards(ctx.controller, 1);
    }
  }, { description: 'Target creature gets -4/-0 until end of turn. If you control a Fish, Octopus, Otter, Seal, Serpent, or Whale, draw a card.' })
  .build();
