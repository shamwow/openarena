import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const BlasphemousAct = CardBuilder.create('Blasphemous Act')
  .cost('{8}{R}')
  .types(CardType.SORCERY)
  .affinity({ types: [CardType.CREATURE] }, 'This spell costs {1} less for each creature on the battlefield')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of creatures) {
      ctx.game.dealDamage(ctx.source.objectId, creature.objectId, 13, false);
    }
  }, { description: 'Blasphemous Act deals 13 damage to each creature.' })
  .build();
