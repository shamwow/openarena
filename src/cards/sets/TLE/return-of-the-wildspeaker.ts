import { CardBuilder } from '../../CardBuilder';
import { CardType } from '../../../engine/types';

export const ReturnOfTheWildspeaker = CardBuilder.create('Return of the Wildspeaker')
  .cost('{4}{G}')
  .types(CardType.INSTANT)
  .modal([
    {
      label: 'Draw cards equal to the greatest power among non-Human creatures you control',
      effect: async (ctx) => {
        const nonHumans = ctx.game.getBattlefield({ types: [CardType.CREATURE] }, ctx.controller)
          .filter(c => !c.definition.subtypes.includes('Human'));
        let greatestPower = 0;
        for (const c of nonHumans) {
          const power = c.modifiedPower ?? c.definition.power ?? 0;
          if (power > greatestPower) greatestPower = power;
        }
        if (greatestPower > 0) {
          ctx.game.drawCards(ctx.controller, greatestPower);
        }
      },
    },
    {
      label: 'Non-Human creatures you control get +3/+3 until end of turn',
      effect: async (ctx) => {
        const nonHumans = ctx.game.getBattlefield({ types: [CardType.CREATURE] }, ctx.controller)
          .filter(c => !c.definition.subtypes.includes('Human'));
        const ids = nonHumans.map(c => c.objectId);
        ctx.game.grantPumpToObjectsUntilEndOfTurn(ids, 3, 3);
      },
    },
  ], 1, 'Choose one —')
  .build();
