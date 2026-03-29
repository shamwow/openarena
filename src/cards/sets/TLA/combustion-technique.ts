import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';
import { markExileInsteadOfDyingThisTurn } from '../../../engine/GameState';

export const CombustionTechnique = CardBuilder.create('Combustion Technique')
  .cost('{1}{R}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne(
      'Deal damage to target creature',
      creatures,
      c => c.definition.name
    );
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const lessonCount = graveyard.filter(c => c.definition.subtypes.includes('Lesson')).length;
    const damage = 2 + lessonCount;
    ctx.game.dealDamage(ctx.source.objectId, target.objectId, damage, false);
    markExileInsteadOfDyingThisTurn(ctx.state, target.objectId);
  }, { description: 'Combustion Technique deals damage equal to 2 plus the number of Lesson cards in your graveyard to target creature. If that creature would die this turn, exile it instead.' })
  .build();
