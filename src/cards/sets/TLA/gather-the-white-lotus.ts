import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const GatherTheWhiteLotus = CardBuilder.create('Gather the White Lotus')
  .cost('{4}{W}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const plains = ctx.game.getBattlefield({ types: [CardType.LAND] }, ctx.controller)
      .filter(c => c.definition.subtypes.includes('Plains'));
    for (let i = 0; i < plains.length; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Ally',
        types: [CardType.CREATURE],
        subtypes: ['Ally'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    }
    await ctx.game.scry(ctx.controller, 2);
  }, { description: 'Create a 1/1 white Ally creature token for each Plains you control. Scry 2.' })
  .build();
