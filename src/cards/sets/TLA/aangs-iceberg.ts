import { CardBuilder } from '../../CardBuilder';
import { CardType, parseManaCost } from '../../../engine/types';

export const AangsIceberg = CardBuilder.create("Aang's Iceberg")
  .cost('{2}{W}')
  .types(CardType.ENCHANTMENT)
  .flash()
  .etbEffect(async (ctx) => {
    // Exile up to one other target nonland permanent until this leaves
    const targets = ctx.game.getBattlefield().filter(
      c => c.objectId !== ctx.source.objectId && !c.definition.types.includes(CardType.LAND),
    );
    if (targets.length > 0) {
      const chosen = await ctx.choices.chooseUpToN('Exile up to one target nonland permanent', targets, 1, c => c.definition.name);
      for (const target of chosen) {
        // TODO: Return when this enchantment leaves the battlefield
        ctx.game.exilePermanent(target.objectId);
      }
    }
  }, { description: 'When this enchantment enters, exile up to one other target nonland permanent until this enchantment leaves the battlefield.' })
  .activated(
    { mana: parseManaCost('{3}'), sacrifice: { self: true }, genericTapSubstitution: { amount: 3, filter: { types: [CardType.ARTIFACT, CardType.CREATURE], controller: 'you' }, ignoreSummoningSickness: true } },
    async (ctx) => {
      await ctx.game.scry(ctx.controller, 2);
    },
    {
      description: 'Waterbend {3}: Sacrifice this enchantment. If you do, scry 2.',
    },
  )
  .build();
