import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ZukosExile = CardBuilder.create("Zuko's Exile")
  .cost('{5}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const targets = ctx.game.getBattlefield().filter(c =>
      c.definition.types.includes(CardType.ARTIFACT) ||
      c.definition.types.includes(CardType.CREATURE) ||
      c.definition.types.includes(CardType.ENCHANTMENT),
    );
    if (targets.length === 0) return;
    const target = await ctx.choices.chooseOne('Exile target artifact, creature, or enchantment', targets, c => c.definition.name);
    const controller = target.controller;
    ctx.game.exilePermanent(target.objectId);
    ctx.game.createPredefinedToken(controller, 'Clue');
  }, { description: 'Exile target artifact, creature, or enchantment. Its controller creates a Clue token.' })
  .build();
