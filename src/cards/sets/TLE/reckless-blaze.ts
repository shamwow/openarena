import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const RecklessBlaze = CardBuilder.create('Reckless Blaze')
  .cost('{3}{R}{R}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    for (const creature of creatures) {
      ctx.game.dealDamage(ctx.source.objectId, creature.objectId, 5, false);
    }
    // TODO: Track creatures dealt damage this way that die this turn to add {R} for each
  }, { description: 'Reckless Blaze deals 5 damage to each creature. Whenever a creature you control dealt damage this way dies this turn, add {R}.' })
  .build();
