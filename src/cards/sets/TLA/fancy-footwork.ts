import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FancyFootwork = CardBuilder.create('Fancy Footwork')
  .cost('{2}{W}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller);
    if (creatures.length > 0) {
      const targets = await ctx.choices.chooseUpToN('Untap one or two target creatures', creatures, 2, c => c.definition.name);
      for (const target of targets) {
        ctx.game.untapPermanent(target.objectId);
        ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
      }
    }
  }, { description: 'Untap one or two target creatures. They each get +2/+2 until end of turn.' })
  .build();
