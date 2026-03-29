import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const FireNavyTrebuchet = CardBuilder.create('Fire Navy Trebuchet')
  .cost('{2}{B}')
  .types(CardType.ARTIFACT, CardType.CREATURE)
  .subtypes('Wall')
  .stats(0, 4)
  .defender()
  .reach()
  .triggered(
    { on: 'attacks', filter: { controller: 'you' } },
    (ctx) => {
      // TODO: Token should be tapped and attacking, and sacrificed at next end step
      ctx.game.createToken(ctx.controller, {
        name: 'Ballistic Boulder',
        types: [CardType.ARTIFACT, CardType.CREATURE],
        subtypes: ['Construct'],
        power: 2,
        toughness: 1,
        colorIdentity: [],
        abilities: [],
      });
    },
    { description: 'Whenever you attack, create a 2/1 colorless Construct artifact creature token with flying named Ballistic Boulder that\'s tapped and attacking. Sacrifice that token at the beginning of the next end step.' },
  )
  .build();
