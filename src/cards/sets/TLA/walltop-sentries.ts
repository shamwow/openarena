import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const WalltopSentries = CardBuilder.create('Walltop Sentries')
  .cost('{2}{G}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier', 'Ally')
  .stats(2, 3)
  .reach()
  .deathtouch()
  .diesEffect((ctx) => {
    const graveyard = ctx.game.getGraveyard(ctx.controller);
    const hasLesson = graveyard.some(c => c.definition.subtypes?.includes('Lesson'));
    if (hasLesson) {
      ctx.game.gainLife(ctx.controller, 2);
    }
  }, { description: 'When this creature dies, if there\'s a Lesson card in your graveyard, you gain 2 life.' })
  .build();
