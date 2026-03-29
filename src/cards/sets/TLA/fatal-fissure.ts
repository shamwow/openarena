import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FatalFissure = CardBuilder.create('Fatal Fissure')
  .cost('{1}{B}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    // TODO: Set up a delayed trigger: when that creature dies this turn, earthbend 4
    // Simplified: we just mark it; the delayed trigger is complex
    void target;
  }, { description: 'Choose target creature. When that creature dies this turn, you earthbend 4.' })
  .build();
