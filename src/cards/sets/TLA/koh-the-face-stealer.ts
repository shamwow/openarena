import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KohTheFaceStealer = CardBuilder.create('Koh, the Face Stealer')
  .cost('{4}{B}{B}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Shapeshifter', 'Spirit')
  .stats(6, 6)
  .etbEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.objectId !== ctx.source.objectId);
    if (creatures.length > 0) {
      const chosen = await ctx.choices.chooseUpToN(
        'Exile up to one other target creature',
        creatures,
        1,
        c => c.definition.name,
      );
      for (const creature of chosen) {
        ctx.game.exilePermanent(creature.objectId);
      }
    }
  }, { description: 'When Koh enters, exile up to one other target creature.' })
  .triggered(
    { on: 'dies', filter: { types: [CardType.CREATURE] } },
    async (ctx) => {
      // TODO: Properly track the dying creature and check it's nontoken and not self
      // Simplified: whenever another nontoken creature dies, you may exile it from graveyard
      const graveyard = ctx.game.getGraveyard(ctx.controller);
      const creatures = graveyard.filter(c =>
        c.definition.types.includes(CardType.CREATURE) && !c.isToken,
      );
      if (creatures.length > 0) {
        const chosen = await ctx.choices.chooseUpToN(
          'Exile a creature that just died?',
          creatures,
          1,
          c => c.definition.name,
        );
        for (const creature of chosen) {
          ctx.game.moveCard(creature.objectId, 'EXILE', creature.owner);
        }
      }
    },
    { optional: true, description: 'Whenever another nontoken creature dies, you may exile it.' },
  )
  // TODO: "Pay 1 life: Choose a creature card exiled with Koh. Koh has all activated and triggered abilities of the last chosen card."
  .activated(
    { payLife: 1 },
    async (_ctx) => {
      // TODO: Choose a creature card exiled with Koh, gain its abilities
    },
    { description: 'Pay 1 life: Choose a creature card exiled with Koh. Koh has all activated and triggered abilities of the last chosen card.' },
  )
  .build();
