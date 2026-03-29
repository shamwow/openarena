import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DeadlyPrecision = CardBuilder.create('Deadly Precision')
  .cost('{B}')
  .types(CardType.SORCERY)
  // TODO: Additional cost of pay {4} or sacrifice an artifact or creature
  .additionalCost('deadly-precision-cost', '{4}', 'Pay {4} or sacrifice an artifact or creature', { optional: false })
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Destroy target creature', creatures, c => c.definition.name);
      ctx.game.destroyPermanent(target.objectId);
    }
  }, { description: 'Destroy target creature.' })
  .build();
