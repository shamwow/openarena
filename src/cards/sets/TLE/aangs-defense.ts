import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const AangsDefense = CardBuilder.create("Aang's Defense")
  .cost('{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const combat = ctx.state.combat;
    const creatures = combat
      ? ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter((card) => combat.blockers.has(card.objectId))
      : [];
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Target blocking creature you control', creatures, c => c.definition.name);
      ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], 2, 2);
    }
    ctx.game.drawCards(ctx.controller, 1);
  }, { description: 'Target blocking creature you control gets +2/+2 until end of turn. Draw a card.' })
  .build();
