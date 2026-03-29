import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

export const MatchTheOdds = CardBuilder.create('Match the Odds')
  .cost('{2}{G}')
  .types(CardType.SORCERY)
  .subtypes('Lesson')
  .spellEffect((ctx) => {
    const opponentCreatures = ctx.game.getBattlefield({ types: [CardType.CREATURE] })
      .filter(c => c.controller !== ctx.controller);
    const count = opponentCreatures.length;
    const token = ctx.game.createToken(ctx.controller, {
      name: 'Ally',
      types: [CardType.CREATURE],
      subtypes: ['Ally'],
      power: 1,
      toughness: 1,
      colorIdentity: [ManaColor.WHITE],
    });
    if (count > 0) {
      ctx.game.addCounters(token.objectId, '+1/+1', count);
    }
  }, { description: 'Create a 1/1 white Ally creature token. Put a +1/+1 counter on it for each creature your opponents control.' })
  .build();
