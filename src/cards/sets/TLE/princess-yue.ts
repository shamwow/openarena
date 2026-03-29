import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const PrincessYue = CardBuilder.create('Princess Yue')
  .cost('{2}{U}')
  .types(CardType.CREATURE)
  .supertypes('Legendary')
  .subtypes('Human', 'Noble', 'Ally')
  .stats(3, 2)
  .diesEffect((ctx) => {
    // TODO: Return to battlefield as a land named Moon with "{T}: Add {C}."
    // This requires transforming the card's types/abilities on return
  }, { description: 'When Princess Yue dies, if she was a nonland creature, return this card to the battlefield tapped under your control. She\'s a land named Moon. She gains "{T}: Add {C}."' })
  .activated(
    { tap: true },
    async (ctx) => {
      await ctx.game.scry(ctx.controller, 2);
    },
    { description: '{T}: Scry 2.' },
  )
  .build();
