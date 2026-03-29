import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const CallousInspector = CardBuilder.create('Callous Inspector')
  .cost('{B}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(1, 1)
  .menace()
  .diesEffect(async (ctx) => {
    ctx.game.dealDamage(ctx.source.objectId, ctx.controller, 1, false);
    ctx.game.createPredefinedToken(ctx.controller, 'Clue');
  }, { description: 'When this creature dies, it deals 1 damage to you. Create a Clue token.' })
  .build();
