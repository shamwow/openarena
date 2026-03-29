import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SecretOfBloodbending = CardBuilder.create('Secret of Bloodbending')
  .cost('{U}{U}{U}{U}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .additionalCost('waterbend-cost', { waterbend: 10 }, 'Waterbend {10}', { optional: true })
  .spellEffect(async (ctx) => {
    const opponents = ctx.game.getOpponents(ctx.controller);
    if (opponents.length === 0) return;
    const target = await ctx.choices.choosePlayer('Choose target opponent', opponents);
    // TODO: Control target opponent during their next combat phase (or full turn if additional cost was paid)
    // This requires complex game state manipulation that is beyond the scope of card effects
    // Exile Secret of Bloodbending
    ctx.game.moveCard(ctx.source.objectId, 'EXILE');
  }, { description: 'You control target opponent during their next combat phase. If this spell\'s additional cost was paid, you control that player during their next turn instead. Exile Secret of Bloodbending.' })
  .build();
