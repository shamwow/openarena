import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const DeadlyRollick = CardBuilder.create('Deadly Rollick')
  .cost('{3}{B}')
  .types(CardType.INSTANT)
  // TODO: If you control a commander, you may cast this spell without paying its mana cost.
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length > 0) {
      const target = await ctx.choices.chooseOne('Exile target creature', creatures, c => c.definition.name);
      ctx.game.moveCard(target.objectId, 'EXILE', target.owner);
    }
  }, { description: 'Exile target creature.' })
  .build();
