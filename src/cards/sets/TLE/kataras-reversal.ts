import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KatarasReversal = CardBuilder.create("Katara's Reversal")
  .cost('{2}{U}{U}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // Counter up to four target spells and/or abilities
    const stackEntries = ctx.state.stack.filter(e => e.entryType === 'SPELL' || e.entryType === 'ABILITY');
    if (stackEntries.length > 0) {
      const toCounter = await ctx.choices.chooseUpToN(
        'Counter up to four target spells and/or abilities',
        stackEntries,
        4,
        e => e.cardInstance?.definition.name ?? 'Ability',
      );
      for (const entry of toCounter) {
        ctx.game.counterSpell(entry.id);
      }
    }
    // Untap up to four target artifacts and/or creatures
    const permanents = ctx.game.getBattlefield().filter(c =>
      c.definition.types.includes(CardType.ARTIFACT) || c.definition.types.includes(CardType.CREATURE),
    );
    if (permanents.length > 0) {
      const toUntap = await ctx.choices.chooseUpToN(
        'Untap up to four target artifacts and/or creatures',
        permanents,
        4,
        c => c.definition.name,
      );
      for (const perm of toUntap) {
        ctx.game.untapPermanent(perm.objectId);
      }
    }
  }, { description: 'Counter up to four target spells and/or abilities. Untap up to four target artifacts and/or creatures.' })
  .build();
