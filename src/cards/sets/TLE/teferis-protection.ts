import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const TeferisProtection = CardBuilder.create("Teferi's Protection")
  .cost('{2}{W}')
  .types(CardType.INSTANT)
  .spellEffect(async (ctx) => {
    // TODO: Until your next turn, your life total can't change and you gain protection from everything
    // Phase out all permanents you control
    const permanents = ctx.game.getBattlefield({ controller: 'you' }, ctx.controller);
    for (const permanent of permanents) {
      // TODO: Phase out permanents (phaseOut not directly available, using custom approach)
    }
    // Exile Teferi's Protection
    ctx.game.moveCard(ctx.source.objectId, 'EXILE');
  }, { description: "Until your next turn, your life total can't change and you gain protection from everything. All permanents you control phase out. Exile Teferi's Protection." })
  .build();
