import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FoggySwampVisions = CardBuilder.create('Foggy Swamp Visions')
  .cost('{1}{B}{B}')
  .types(CardType.SORCERY)
  // TODO: Waterbend X as additional cost is dynamic
  .spellEffect(async (ctx) => {
    // Simplified: choose X creature cards from graveyards to exile
    const allGraveyards = [...ctx.game.getGraveyard(ctx.controller)];
    const opponents = ctx.game.getOpponents(ctx.controller);
    for (const opp of opponents) {
      allGraveyards.push(...ctx.game.getGraveyard(opp));
    }
    const creatureCards = allGraveyards.filter(c => c.definition.types.includes(CardType.CREATURE));
    if (creatureCards.length === 0) return;
    const x = ctx.costsPaid?.xValue ?? creatureCards.length;
    const chosen = await ctx.choices.chooseUpToN(
      `Exile up to ${x} target creature cards from graveyards`,
      creatureCards,
      x,
      c => c.definition.name,
    );
    for (const card of chosen) {
      ctx.game.moveCard(card.objectId, 'EXILE', card.owner);
      // Create a token copy
      ctx.game.createToken(ctx.controller, {
        name: card.definition.name,
        types: [...card.definition.types],
        subtypes: [...card.definition.subtypes],
        power: card.definition.power,
        toughness: card.definition.toughness,
        colorIdentity: [...card.definition.colorIdentity],
        abilities: [...card.definition.abilities],
      });
      // TODO: Sacrifice token copies at beginning of next end step
    }
  }, { description: 'Exile X target creature cards from graveyards. For each creature card exiled this way, create a token that\'s a copy of it. At the beginning of your next end step, sacrifice those tokens.' })
  .build();
