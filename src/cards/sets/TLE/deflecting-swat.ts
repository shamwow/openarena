import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DeflectingSwat = CardBuilder.create('Deflecting Swat')
  .cost('{2}{R}')
  .types(CardType.INSTANT)
  // TODO: If you control a commander, you may cast this spell without paying its mana cost.
  .spellEffect(async (ctx) => {
    // TODO: "You may choose new targets for target spell or ability" requires deep stack interaction
    // Simplified: this is a stub for the redirect effect
    const stackSpells = ctx.state.stack.filter(e => e.entryType === 'SPELL' || e.entryType === 'ABILITY');
    if (stackSpells.length > 0) {
      const _target = await ctx.choices.chooseOne(
        'Choose target spell or ability to retarget',
        stackSpells,
        e => e.cardInstance?.definition.name ?? 'Unknown'
      );
      // TODO: Implement target redirection
    }
  }, { description: 'You may choose new targets for target spell or ability.' })
  .build();
