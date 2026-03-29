import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CuriousFarmAnimals = CardBuilder.create('Curious Farm Animals')
  .cost('{W}')
  .types(CardType.CREATURE)
  .subtypes('Boar', 'Elk', 'Bird', 'Ox')
  .stats(1, 1)
  .diesEffect((ctx) => {
    ctx.game.gainLife(ctx.controller, 3);
  }, { description: 'When this creature dies, you gain 3 life.' })
  .activated(
    { mana: { generic: 2, W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, X: 0 }, sacrifice: { self: true } },
    async (ctx) => {
      const targets = ctx.game.getBattlefield().filter(
        c => c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.ENCHANTMENT)
      );
      if (targets.length > 0) {
        const chosen = await ctx.choices.chooseUpToN('Destroy up to one target artifact or enchantment', targets, 1, c => c.definition.name);
        for (const t of chosen) {
          ctx.game.destroyPermanent(t.objectId);
        }
      }
    },
    { timing: 'sorcery', description: '{2}, Sacrifice this creature: Destroy up to one target artifact or enchantment.' }
  )
  .build();
