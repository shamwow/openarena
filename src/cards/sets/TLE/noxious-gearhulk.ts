import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const NoxiousGearhulk = CardBuilder.create('Noxious Gearhulk')
  .cost('{4}{B}{B}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .subtypes('Construct')
  .stats(5, 4)
  .menace()
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.objectId !== ctx.source.objectId);
    if (creatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('You may destroy another target creature', creatures, 1, c => c.definition.name);
      for (const target of chosen) {
        const toughness = target.modifiedToughness ?? target.definition.toughness ?? 0;
        ctx.game.destroyPermanent(target.objectId);
        ctx.game.gainLife(ctx.controller, toughness);
      }
    }
  }, { optional: true, description: 'When this creature enters, you may destroy another target creature. If a creature is destroyed this way, you gain life equal to its toughness.' })
  .build();
