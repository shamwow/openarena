import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const SoldOut = CardBuilder.create('Sold Out')
  .cost('{3}{B}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Exile target creature', creatures, c => c.definition.name);
    // TODO: Track if it was dealt damage this turn
    ctx.game.exilePermanent(target.objectId);
    // Simplified: always create Clue for now
    // TODO: Only create Clue if creature was dealt damage this turn
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'Exile target creature. If it was dealt damage this turn, create a Clue token.' })
  .build();
