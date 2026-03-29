import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { getEffectiveSubtypes } from '../../../engine/GameState';

export const ThreeDreams = CardBuilder.create('Three Dreams')
  .cost('{4}{W}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const library = ctx.game.getLibrary(ctx.controller);
    const auras = library.filter((c) =>
      c.definition.types.includes(CardType.ENCHANTMENT)
      && c.definition.subtypes.includes('Aura'),
    );
    if (auras.length === 0) {
      ctx.game.shuffleLibrary(ctx.controller);
      return;
    }
    const chosen: typeof auras = [];
    const remaining = [...auras];
    for (let i = 0; i < 3 && remaining.length > 0; i++) {
      const pick = await ctx.choices.chooseUpToN(
        `Choose an Aura card (${i + 1}/3)`,
        remaining.filter((c) => !chosen.some((ch) => ch.definition.name === c.definition.name)),
        1,
        (c) => c.definition.name,
      );
      if (pick.length === 0) break;
      chosen.push(pick[0]);
    }
    for (const card of chosen) {
      ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
    }
    ctx.game.shuffleLibrary(ctx.controller);
  }, { description: 'Search your library for up to three Aura cards with different names, reveal them, put them into your hand, then shuffle.' })
  .build();
