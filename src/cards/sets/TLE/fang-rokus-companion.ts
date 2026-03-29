import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const FangRokusCompanion = CardBuilder.create("Fang, Roku's Companion")
  .cost('{3}{R}{R}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Dragon')
  .stats(4, 4)
  .flying()
  .triggered(
    { on: 'attacks', filter: { self: true } },
    async (ctx) => {
      const legendaryCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE], controller: 'you' }, ctx.controller)
        .filter(c => c.objectId !== ctx.source.objectId && c.definition.supertypes.includes('Legendary'));
      if (legendaryCreatures.length > 0) {
        const target = await ctx.choices.chooseOne('Choose a legendary creature to pump', legendaryCreatures, c => c.definition.name);
        const fangPower = ctx.source.modifiedPower ?? ctx.source.definition.power ?? 4;
        ctx.game.grantPumpToObjectsUntilEndOfTurn([target.objectId], fangPower, 0);
      }
    },
    { description: "Whenever Fang attacks, another target legendary creature you control gets +X/+0 until end of turn, where X is Fang's power." }
  )
  .diesEffect((ctx) => {
    const isSpirit = ctx.source.definition.subtypes.includes('Spirit');
    if (!isSpirit) {
      // Return to battlefield as a Spirit
      ctx.game.moveCard(ctx.source.objectId, 'BATTLEFIELD', ctx.controller);
      // TODO: Add Spirit subtype to the returned card
    }
  }, { description: "When Fang dies, if he wasn't a Spirit, return this card to the battlefield under your control. He's a Spirit in addition to his other types." })
  .build();
