import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ElementalTeachings = CardBuilder.create('Elemental Teachings')
  .cost('{4}{G}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const uniqueLands: typeof library = [];
    const seenNames = new Set<string>();

    for (const card of library) {
      if (!card.definition.types.includes(CardType.LAND)) continue;
      if (seenNames.has(card.definition.name)) continue;
      seenNames.add(card.definition.name);
      uniqueLands.push(card);
    }

    if (uniqueLands.length === 0) {
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }

    const selected = await ctx.choices.chooseUpToN(
      'Search your library for up to four land cards with different names',
      uniqueLands,
      Math.min(4, uniqueLands.length),
      (card) => card.definition.name,
    );

    if (selected.length === 0) {
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }

    const opponents = ctx.game.getOpponents(ctx.controller);
    const chosenOpponent = opponents.length > 0
      ? await ctx.choices.choosePlayer('Choose an opponent to choose from the revealed lands', opponents)
      : null;
    if (!chosenOpponent) {
      for (const card of selected) {
        ctx.game.moveCard(card.objectId, 'GRAVEYARD', ctx.controller);
      }
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }

    const chosen = await ctx.game.searchLibraryWithOptions({
      player: ctx.controller,
      chooser: chosenOpponent,
      filter: {
        custom: (candidate) => selected.some((card) => card.objectId === candidate.objectId),
      },
      destination: 'GRAVEYARD',
      count: Math.min(2, selected.length),
      optional: false,
      shuffle: false,
    });
    const chosenIds = new Set(chosen.map((card) => card.objectId));

    for (const card of selected) {
      if (chosenIds.has(card.objectId)) {
        continue;
      }

      ctx.game.moveCard(card.objectId, 'BATTLEFIELD', ctx.controller);
      const battlefieldCard = ctx.game.getCard(card.objectId);
      if (battlefieldCard) {
        battlefieldCard.tapped = true;
      }
    }

    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: "Search your library for up to four land cards with different names and reveal them. An opponent chooses two of those cards. Put the chosen cards into your graveyard and the rest onto the battlefield tapped, then shuffle." })
  .build();
