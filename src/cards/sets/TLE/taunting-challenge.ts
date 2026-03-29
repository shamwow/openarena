import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TauntingChallenge = CardBuilder.create('Taunting Challenge')
  .cost('{1}{G}{G}')
  .types(CardType.SORCERY)
  .spellEffect(async (ctx) => {
    const creatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] });
    if (creatures.length === 0) return;
    const target = await ctx.choices.chooseOne('Choose target creature', creatures, c => c.definition.name);
    // TODO: All creatures able to block target creature this turn do so
    // This requires combat system integration
  }, { description: 'All creatures able to block target creature this turn do so.' })
  .build();
