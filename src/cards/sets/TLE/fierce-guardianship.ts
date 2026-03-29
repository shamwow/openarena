import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FierceGuardianship = CardBuilder.create('Fierce Guardianship')
  .cost('{2}{U}')
  .types(CardType.INSTANT)
  // TODO: If you control a commander, you may cast this spell without paying its mana cost.
  .spellEffect(async (ctx) => {
    const stackSpells = ctx.state.stack.filter(
      e => e.entryType === 'SPELL' && e.cardInstance &&
           !e.cardInstance.definition.types.includes(CardType.CREATURE)
    );
    if (stackSpells.length > 0) {
      const target = await ctx.choices.chooseOne(
        'Counter target noncreature spell',
        stackSpells,
        e => e.cardInstance?.definition.name ?? 'Unknown spell'
      );
      ctx.game.counterSpell(target.id);
    }
  }, { description: 'Counter target noncreature spell.' })
  .build();
