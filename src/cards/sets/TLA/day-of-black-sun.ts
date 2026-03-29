import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DayOfBlackSun = CardBuilder.create('Day of Black Sun')
  .cost('{X}{B}{B}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const x = ctx.xValue ?? 0;
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    const targets = creatures.filter(c => {
      const mv = c.definition.cost?.mana
        ? (c.definition.cost.mana.generic + c.definition.cost.mana.W + c.definition.cost.mana.U + c.definition.cost.mana.B + c.definition.cost.mana.R + c.definition.cost.mana.G + c.definition.cost.mana.C)
        : 0;
      return mv <= x;
    });
    // TODO: "loses all abilities until end of turn" is complex to implement fully
    for (const creature of targets) {
      ctx.game.destroyPermanent(creature.objectId);
    }
  }, { description: 'Each creature with mana value X or less loses all abilities until end of turn. Destroy those creatures.' })
  .build();
