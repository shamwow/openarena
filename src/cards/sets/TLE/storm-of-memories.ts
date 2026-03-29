import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const StormOfMemories = CardBuilder.create('Storm of Memories')
  .cost('{2}{R}{R}{R}')
  .types(CardType.SORCERY)
  .storm()
  .spellEffect(async (ctx) => {
    // Exile an instant or sorcery with MV 3 or less from graveyard at random, cast it for free
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const eligible = graveyard.filter(c =>
      (c.definition.types.includes(CardType.INSTANT) || c.definition.types.includes(CardType.SORCERY))
      // TODO: Filter by mana value <= 3
    );
    if (eligible.length === 0) return;
    const randomIndex = Math.floor(Math.random() * eligible.length);
    const chosen = eligible[randomIndex];
    ctx.game.moveCard(chosen.objectId, 'EXILE');
    await ctx.game.castWithoutPayingManaCost(chosen.objectId, ctx.controller);
    // If that spell would be put into a graveyard, exile it instead — handled by cast
  }, { description: 'Exile an instant or sorcery card with mana value 3 or less from your graveyard at random. You may cast it without paying its mana cost. If that spell would be put into a graveyard, exile it instead.' })
  .build();
