import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ItllQuenchYa = CardBuilder.create("It'll Quench Ya!")
  .cost('{1}{U}')
  .types(CardType.INSTANT)
  .subtypes('Lesson')
  .spellEffect(async (ctx) => {
    // TODO: Counter target spell unless its controller pays {2}
  }, { description: 'Counter target spell unless its controller pays {2}.' })
  .build();
