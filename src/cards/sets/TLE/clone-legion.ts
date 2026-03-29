import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CloneLegion = CardBuilder.create('Clone Legion')
  .cost('{7}{U}{U}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const allPlayers = [ctx.controller, ...ctx.game.getOpponents(ctx.controller)];
    const targetPlayer = await ctx.choices.choosePlayer('Choose target player', allPlayers);
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] }, targetPlayer);
    for (const creature of creatures) {
      ctx.game.copyPermanent(creature.objectId, ctx.controller);
    }
  }, { description: 'For each creature target player controls, create a token that\'s a copy of that creature.' })
  .build();
