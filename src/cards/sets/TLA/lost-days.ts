import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const LostDays = CardBuilder.create('Lost Days')
  .cost('{4}{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(
      c => c.definition.types.includes(CardType.CREATURE) || c.definition.types.includes(CardType.ENCHANTMENT),
    );
    if (targets.length > 0) {
      const target = await ctx.choices.chooseOne('Choose target creature or enchantment', targets, c => c.definition.name);
      // TODO: Owner puts it second from top or on bottom (choice)
      ctx.game.moveCard(target.objectId, 'LIBRARY', target.owner);
    }
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'The owner of target creature or enchantment puts it into their library second from the top or on the bottom. You create a Clue token.' })
  .build();
