import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const KoalaSheep = CardBuilder.create('Koala-Sheep')
  .cost('{2}{W}')
  .types(CardType.CREATURE)
  .subtypes('Bear', 'Sheep')
  .stats(3, 2)
  .etbEffect((ctx) => {
    ctx.game.gainLife(ctx.controller, 3);
  }, { description: 'When this creature enters, you gain 3 life.' })
  .build();
