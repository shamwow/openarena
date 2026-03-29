import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AvatarsWrath = CardBuilder.create("Avatar's Wrath")
  .cost('{2}{W}{W}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    // Choose up to one target creature to keep
    const chosen = await ctx.choices.chooseUpToN('Choose up to one target creature to keep', creatures, 1, c => c.definition.name);
    const keepId = chosen.length > 0 ? chosen[0].objectId : null;

    // Airbend all other creatures
    const toAirbend = creatures.filter(c => c.objectId !== keepId);
    for (const creature of toAirbend) {
      ctx.game.airbendObject(creature.objectId, { mana: parseManaCost('{2}') }, creature.controller);
    }

    // TODO: Until your next turn, opponents can't cast spells from anywhere other than their hands
    // Exile Avatar's Wrath
    ctx.game.exilePermanent(ctx.source.objectId);
  }, { description: "Choose up to one target creature, then airbend all other creatures. Until your next turn, opponents can't cast spells from anywhere other than their hands. Exile Avatar's Wrath." })
  .build();
