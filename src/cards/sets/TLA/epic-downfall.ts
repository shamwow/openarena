import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const EpicDownfall = CardBuilder.create('Epic Downfall')
  .cost('{1}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }).filter(c => {
      const mv = c.definition.cost?.mana
        ? (c.definition.cost.mana.generic + c.definition.cost.mana.W + c.definition.cost.mana.U + c.definition.cost.mana.B + c.definition.cost.mana.R + c.definition.cost.mana.G + c.definition.cost.mana.C)
        : 0;
      return mv >= 3;
    });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Exile target creature with mana value 3 or greater', creatures, c => c.definition.name);
      ctx.game.moveCard(target.objectId, 'EXILE', target.owner);
    }
  }, { description: 'Exile target creature with mana value 3 or greater.' })
  .build();
