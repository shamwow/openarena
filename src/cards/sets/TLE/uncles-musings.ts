import { CardBuilder } from '../../CardBuilder';
import type { CardDefinition } from '../../../engine/types';
import { CardType } from '../../../engine/types';

function isPermanentCard(definition: CardDefinition): boolean {
  return definition.types.some((type) => (
    type === CardType.ARTIFACT ||
    type === CardType.CREATURE ||
    type === CardType.ENCHANTMENT ||
    type === CardType.LAND ||
    type === CardType.PLANESWALKER
  ));
}

export const UncleMusings = CardBuilder.create("Uncle's Musings")
  .cost('{2}{G}{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const convergeCount = ctx.colorsSpentToCast?.length ?? 0;
    const permanents = ctx.game
      .getGraveyard(ctx.controller)
      .filter((card) => isPermanentCard(card.definition));

    if (convergeCount > 0 && permanents.length > 0) {
      const chosen = await ctx.choices.chooseUpToN(
        `Return up to ${convergeCount} permanent card(s) from your graveyard to your hand`,
        permanents,
        Math.min(convergeCount, permanents.length),
        (card) => card.definition.name,
      );
      for (const card of chosen) {
        ctx.game.moveCard(card.objectId, 'HAND', ctx.controller);
      }
    }
  }, {
    description: "Converge — Return up to X permanent cards from your graveyard to your hand, where X is the number of colors of mana spent to cast this spell. Exile Uncle's Musings.",
    afterResolution: 'EXILE',
  })
  .build();
