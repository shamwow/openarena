import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const JoinTheDance = CardBuilder.create('Join the Dance')
  .cost('{G}{W}')
  .types(CardType.SORCERY)
  .spellEffect((ctx) => {
    for (let i = 0; i < 2; i++) {
      ctx.game.createToken(ctx.controller, {
        name: 'Human',
        types: [CardType.CREATURE],
        subtypes: ['Human'],
        power: 1,
        toughness: 1,
        colorIdentity: [ManaColor.WHITE],
      });
    }
  }, { description: 'Create two 1/1 white Human creature tokens.' })
  .flashback('{3}{G}{W}')
  .build();
