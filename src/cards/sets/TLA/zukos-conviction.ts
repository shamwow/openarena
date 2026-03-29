import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ZukosConviction = CardBuilder.create("Zuko's Conviction")
  .cost('{B}')
  .types(CardType.INSTANT)
  .kicker('{4}')
  .spellEffect(async (ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const creatureCards = graveyard.filter(c => c.definition.types.includes(CardType.CREATURE));
    if (creatureCards.length === 0) return;
    const target = await ctx.choices.chooseOne('Return target creature card from your graveyard', creatureCards, c => c.definition.name);
    const wasKicked = ctx.additionalCostsPaid?.includes('kicker');
    if (wasKicked) {
      // Put onto the battlefield tapped
      ctx.game.moveCard(target.objectId, 'BATTLEFIELD', ctx.controller);
      // TODO: Enter tapped
    } else {
      ctx.game.returnToHand(target.objectId);
    }
  }, { description: 'Return target creature card from your graveyard to your hand. If this spell was kicked, instead put that card onto the battlefield tapped.' })
  .build();
