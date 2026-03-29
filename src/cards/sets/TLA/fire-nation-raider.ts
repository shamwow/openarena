import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const FireNationRaider = CardBuilder.create('Fire Nation Raider')
  .cost('{3}{R}')
  .types(CardType.CREATURE)
  .subtypes('Human', 'Soldier')
  .stats(4, 2)
  .etbEffect((ctx) => {
    const attackedThisTurn = ctx.state.eventLog.some(
      (e: any) => e.type === 'ATTACKS' && e.lastKnownInfo?.controller === ctx.controller,
    );
    if (attackedThisTurn) {
      ctx.game.createPredefinedToken(ctx.controller, 'Clue');
    }
  }, { description: 'Raid — When Fire Nation Raider enters, if you attacked this turn, create a Clue token.' })
  .build();
